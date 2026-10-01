import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import postgres, { type TransactionSql } from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { assertSafeIntegrationDatabaseUrl } from "../../lib/config/test-database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("Supabase row-level security", () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  assertSafeIntegrationDatabaseUrl(connectionString, process.env.ALLOW_TEST_DATABASE_RESET);

  const sql = postgres(connectionString, { max: 3 });
  const db = drizzle(sql);
  const userA = randomUUID();
  const userB = randomUUID();
  const conversationA = randomUUID();
  const conversationB = randomUUID();
  const messageB = randomUUID();

  async function asUser<T>(userId: string, callback: (tx: TransactionSql) => Promise<T>) {
    return sql.begin(async (tx) => {
      await tx`set local role authenticated`;
      await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
      return callback(tx);
    });
  }

  beforeAll(async () => {
    await sql`drop schema if exists drizzle cascade`;
    await sql`drop table if exists public.user_preferences cascade`;
    await sql`drop function if exists public.set_user_preferences_updated_at() cascade`;
    await sql`drop table if exists public.messages cascade`;
    await sql`drop table if exists public.conversations cascade`;
    await sql`drop table if exists public.users cascade`;
    await sql`drop type if exists public.response_style cascade`;
    await sql`drop type if exists public.response_length cascade`;
    await sql`drop type if exists public.preference_model cascade`;
    await sql`drop type if exists public.preferred_language cascade`;
    await sql`drop type if exists public.message_status cascade`;
    await sql`drop type if exists public.message_role cascade`;
    await sql`drop schema if exists auth cascade`;
    await sql`create schema auth`;
    await sql`create table auth.users (id uuid primary key)`;
    await sql`create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$`;
    await sql`do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$`;
    await sql`grant usage on schema auth to authenticated`;
    await sql`insert into auth.users (id) values (${userA})`;

    await migrate(db, { migrationsFolder: resolve(process.cwd(), "drizzle") });

    await sql`insert into auth.users (id) values (${userB})`;
    await sql`insert into public.conversations (id, user_id, title) values (${conversationA}, ${userA}, 'A conversation'), (${conversationB}, ${userB}, 'B conversation')`;
    await sql`insert into public.messages (id, conversation_id, user_id, role, content, position) values (${messageB}, ${conversationB}, ${userB}, 'user', 'private message', 1)`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it("backfills existing auth users and creates app rows for new sign-ups", async () => {
    const rows = await sql`select id from public.users where id in (${userA}, ${userB})`;
    expect(rows).toHaveLength(2);
  });

  it("allows each user to read only their conversations", async () => {
    const rows = await asUser(userA, (tx) => tx`select id from public.conversations`);
    expect(rows.map((row) => row.id)).toEqual([conversationA]);
  });

  it("rejects creating a conversation for another user", async () => {
    await expect(
      asUser(userA, (tx) =>
        tx`insert into public.conversations (user_id, title) values (${userB}, 'not owned')`,
      ),
    ).rejects.toThrow();
  });

  it("prevents updating or deleting another user's conversation", async () => {
    const { updated, deleted } = await asUser(userA, async (tx) => ({
      updated: await tx`update public.conversations set title = 'hijacked' where id = ${conversationB} returning id`,
      deleted: await tx`delete from public.conversations where id = ${conversationB} returning id`,
    }));
    expect(updated).toHaveLength(0);
    expect(deleted).toHaveLength(0);

    const [ownerRow] = await sql`select title from public.conversations where id = ${conversationB}`;
    expect(ownerRow.title).toBe("B conversation");
  });

  it("prevents cross-user message reads and writes", async () => {
    const rows = await asUser(userA, (tx) =>
      tx`select id from public.messages where conversation_id = ${conversationB}`,
    );
    expect(rows).toHaveLength(0);

    await expect(
      asUser(userA, (tx) =>
        tx`insert into public.messages (conversation_id, user_id, role, content, position) values (${conversationB}, ${userB}, 'user', 'not owned', 2)`,
      ),
    ).rejects.toThrow();

    const { updated, deleted } = await asUser(userA, async (tx) => ({
      updated: await tx`update public.messages set content = 'hijacked' where id = ${messageB} returning id`,
      deleted: await tx`delete from public.messages where id = ${messageB} returning id`,
    }));
    expect(updated).toHaveLength(0);
    expect(deleted).toHaveLength(0);
    const [ownerRow] = await sql`select content from public.messages where id = ${messageB}`;
    expect(ownerRow.content).toBe("private message");
  });

  it("allows users to read only their own profile row", async () => {
    const rows = await asUser(userA, (tx) => tx`select id from public.users`);
    expect(rows.map((row) => row.id)).toEqual([userA]);
  });

  it("persists a conversation, selected model, ordered user history, rename, and delete", async () => {
    const id = randomUUID();
    await asUser(userA, async (tx) => {
      await tx`insert into public.conversations (id, user_id, title, selected_model) values (${id}, ${userA}, 'New chat', 'Reasoning')`;
      await tx`insert into public.messages (conversation_id, user_id, role, content, position) values (${id}, ${userA}, 'user', 'first prompt', 1), (${id}, ${userA}, 'user', 'second prompt', 2)`;
      const conversations = await tx`select id, title, selected_model from public.conversations where id = ${id}`;
      expect(conversations).toEqual([{ id, title: "New chat", selected_model: "Reasoning" }]);
      const messages = await tx`select content, position from public.messages where conversation_id = ${id} order by position asc`;
      expect(messages).toEqual([{ content: "first prompt", position: 1 }, { content: "second prompt", position: 2 }]);
      await tx`update public.conversations set title = 'Renamed chat' where id = ${id}`;
      const renamed = await tx`select title from public.conversations where id = ${id}`;
      expect(renamed[0].title).toBe("Renamed chat");
      await tx`delete from public.conversations where id = ${id}`;
      const deleted = await tx`select id from public.conversations where id = ${id}`;
      expect(deleted).toHaveLength(0);
    });
  });

  async function newConversation() {
    const id = randomUUID();
    await asUser(userA, (tx) => tx`insert into public.conversations (id, user_id, selected_model) values (${id}, ${userA}, 'Balanced')`);
    return id;
  }

  it("deduplicates concurrent user submissions and rejects a changed payload", async () => {
    const conversation = await newConversation();
    const message = randomUUID();
    const results = await Promise.all([1, 2].map(() => asUser(userA, (tx) => tx`select * from public.append_user_message(${conversation}, ${message}, 'hello')`)));
    expect(results.map((rows) => rows[0])).toEqual([{ id: message, position: 1 }, { id: message, position: 1 }]);
    const rows = await asUser(userA, (tx) => tx`select id from public.messages where conversation_id = ${conversation}`);
    expect(rows).toHaveLength(1);
    await expect(asUser(userA, (tx) => tx`select * from public.append_user_message(${conversation}, ${message}, 'changed')`)).rejects.toMatchObject({ code: "PT409" });
  });

  it("allows only one concurrent generation and rejects new messages while it runs", async () => {
    const conversation = await newConversation();
    const message = randomUUID();
    await asUser(userA, (tx) => tx`select * from public.append_user_message(${conversation}, ${message}, 'hello')`);
    const results = await Promise.allSettled([1, 2].map(() => asUser(userA, (tx) => tx`select * from public.claim_assistant_message(${conversation}, ${message})`)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const failed = results.find((result) => result.status === "rejected");
    expect(failed?.status === "rejected" && failed.reason).toMatchObject({ code: "PT409" });
    const rows = await asUser(userA, (tx) => tx`select id from public.messages where conversation_id = ${conversation} and status = 'streaming'`);
    expect(rows).toHaveLength(1);
    await expect(asUser(userA, (tx) => tx`select * from public.append_user_message(${conversation}, ${randomUUID()}, 'overlap')`)).rejects.toMatchObject({ code: "PT409" });
    await expect(asUser(userA, (tx) => tx`insert into public.messages (conversation_id, user_id, role, content, status, position) values (${conversation}, ${userA}, 'assistant', 'bypass', 'streaming', 99)`)).rejects.toMatchObject({ code: "23505" });
  });

  it("replaces interrupted generation with a new UUID, fences stale writes, and replays completion", async () => {
    const conversation = await newConversation();
    const message = randomUUID();
    await asUser(userA, (tx) => tx`select * from public.append_user_message(${conversation}, ${message}, 'hello')`);
    const [first] = await asUser(userA, (tx) => tx`select * from public.claim_assistant_message(${conversation}, ${message})`);
    await asUser(userA, (tx) => tx`update public.messages set status = 'interrupted', content = 'partial' where id = ${first.id}`);
    const [second] = await asUser(userA, (tx) => tx`select * from public.claim_assistant_message(${conversation}, ${message})`);
    expect(second.id).not.toBe(first.id);
    const stale = await asUser(userA, (tx) => tx`update public.messages set content = 'stale', status = 'complete' where id = ${first.id} and status = 'streaming' returning id`);
    expect(stale).toHaveLength(0);
    await asUser(userA, (tx) => tx`update public.messages set content = 'saved response', status = 'complete' where id = ${second.id} and status = 'streaming'`);
    const late = await asUser(userA, (tx) => tx`update public.messages set content = 'late', status = 'error' where id = ${second.id} and status = 'streaming' returning id`);
    expect(late).toHaveLength(0);
    const [replay] = await asUser(userA, (tx) => tx`select * from public.claim_assistant_message(${conversation}, ${message})`);
    expect(replay).toMatchObject({ id: second.id, content: "saved response", status: "complete", replayed: true });
    const rows = await asUser(userA, (tx) => tx`select content, status from public.messages where conversation_id = ${conversation} order by position`);
    expect(rows).toEqual([{ content: "hello", status: "complete" }, { content: "saved response", status: "complete" }]);
  });

  it("recovers stale streaming rows and rejects owner violations and superseded prompts", async () => {
    const conversation = await newConversation();
    const message = randomUUID();
    await asUser(userA, (tx) => tx`select * from public.append_user_message(${conversation}, ${message}, 'hello')`);
    const [response] = await asUser(userA, (tx) => tx`select * from public.claim_assistant_message(${conversation}, ${message})`);
    await asUser(userA, (tx) => tx`update public.messages set created_at = now() - interval '6 minutes' where id = ${response.id}`);
    await asUser(userA, (tx) => tx`select public.recover_stale_chat(${conversation})`);
    const [saved] = await asUser(userA, (tx) => tx`select content, status from public.messages where id = ${response.id}`);
    expect(saved).toEqual({ content: "Response stopped.", status: "interrupted" });
    await expect(asUser(userB, (tx) => tx`select * from public.claim_assistant_message(${conversation}, ${message})`)).rejects.toMatchObject({ code: "PT404" });
    await expect(asUser(userB, (tx) => tx`select * from public.append_user_message(${conversation}, ${randomUUID()}, 'not owned')`)).rejects.toMatchObject({ code: "PT404" });
    await asUser(userA, (tx) => tx`select * from public.append_user_message(${conversation}, ${randomUUID()}, 'newer')`);
    await expect(asUser(userA, (tx) => tx`select * from public.claim_assistant_message(${conversation}, ${message})`)).rejects.toMatchObject({ code: "PT409" });
  });
  async function answeredConversation(prompt = "hello", reply = "first answer") {
    const conversation = await newConversation();
    const message = randomUUID();
    await asUser(userA, (tx) => tx`select * from public.append_user_message(${conversation}, ${message}, ${prompt})`);
    const [claimed] = await asUser(userA, (tx) => tx`select * from public.claim_assistant_message(${conversation}, ${message})`);
    await asUser(userA, (tx) => tx`update public.messages set content = ${reply}, status = 'complete' where id = ${claimed.id} and status = 'streaming'`);
    return { conversation, message, response: claimed.id as string };
  }

  it("regenerates a complete last response with a fresh UUID in the same position and fences the old one", async () => {
    const { conversation, message, response } = await answeredConversation();
    const [next] = await asUser(userA, (tx) => tx`select * from public.regenerate_assistant_message(${conversation}, ${message})`);
    expect(next).toMatchObject({ position: 2, content: "…", status: "streaming", replayed: false });
    expect(next.id).not.toBe(response);
    const stale = await asUser(userA, (tx) => tx`update public.messages set content = 'stale', status = 'complete' where id = ${response} and status = 'streaming' returning id`);
    expect(stale).toHaveLength(0);
    await expect(asUser(userA, (tx) => tx`select * from public.regenerate_assistant_message(${conversation}, ${message})`)).rejects.toMatchObject({ code: "PT409" });
    await expect(asUser(userA, (tx) => tx`select * from public.claim_assistant_message(${conversation}, ${message})`)).rejects.toMatchObject({ code: "PT409" });
    await asUser(userA, (tx) => tx`update public.messages set content = 'second answer', status = 'complete' where id = ${next.id} and status = 'streaming'`);
    const rows = await asUser(userA, (tx) => tx`select role, content, status, position from public.messages where conversation_id = ${conversation} order by position`);
    expect(rows).toEqual([
      { role: "user", content: "hello", status: "complete", position: 1 },
      { role: "assistant", content: "second answer", status: "complete", position: 2 },
    ]);
  });

  it("regenerates an errored or missing response, and refuses superseded prompts and other owners", async () => {
    const { conversation, message, response } = await answeredConversation();
    await asUser(userA, (tx) => tx`update public.messages set status = 'error', content = 'Response unavailable.' where id = ${response}`);
    const [retry] = await asUser(userA, (tx) => tx`select * from public.regenerate_assistant_message(${conversation}, ${message})`);
    expect(retry).toMatchObject({ position: 2, status: "streaming" });
    await asUser(userA, (tx) => tx`delete from public.messages where id = ${retry.id}`);
    const [unanswered] = await asUser(userA, (tx) => tx`select * from public.regenerate_assistant_message(${conversation}, ${message})`);
    expect(unanswered).toMatchObject({ position: 2, status: "streaming" });
    await asUser(userA, (tx) => tx`update public.messages set status = 'complete', content = 'done' where id = ${unanswered.id}`);
    await expect(asUser(userB, (tx) => tx`select * from public.regenerate_assistant_message(${conversation}, ${message})`)).rejects.toMatchObject({ code: "PT404" });
    await asUser(userA, (tx) => tx`select * from public.append_user_message(${conversation}, ${randomUUID()}, 'newer')`);
    await expect(asUser(userA, (tx) => tx`select * from public.regenerate_assistant_message(${conversation}, ${message})`)).rejects.toMatchObject({ code: "PT409" });
  });

  it("edits only the latest user message, removes its reply, and keeps the auto title in sync", async () => {
    const { conversation, message } = await answeredConversation("original prompt");
    await asUser(userA, (tx) => tx`update public.conversations set title = 'original prompt' where id = ${conversation}`);
    const [edited] = await asUser(userA, (tx) => tx`select * from public.edit_last_user_message(${conversation}, ${message}, 'edited prompt')`);
    expect(edited).toEqual({ id: message, position: 1 });
    const rows = await asUser(userA, (tx) => tx`select role, content, position from public.messages where conversation_id = ${conversation} order by position`);
    expect(rows).toEqual([{ role: "user", content: "edited prompt", position: 1 }]);
    const [title] = await asUser(userA, (tx) => tx`select title from public.conversations where id = ${conversation}`);
    expect(title.title).toBe("edited prompt");
    const [again] = await asUser(userA, (tx) => tx`select * from public.edit_last_user_message(${conversation}, ${message}, 'edited prompt')`);
    expect(again).toEqual({ id: message, position: 1 });
    const [claimed] = await asUser(userA, (tx) => tx`select * from public.claim_assistant_message(${conversation}, ${message})`);
    expect(claimed).toMatchObject({ position: 2, status: "streaming", replayed: false });
  });

  it("keeps a renamed title, and rejects edits while streaming, on older messages, blanks, and other owners", async () => {
    const { conversation, message } = await answeredConversation("keep my title");
    await asUser(userA, (tx) => tx`update public.conversations set title = 'Renamed by me' where id = ${conversation}`);
    await asUser(userA, (tx) => tx`select * from public.edit_last_user_message(${conversation}, ${message}, 'different prompt')`);
    const [title] = await asUser(userA, (tx) => tx`select title from public.conversations where id = ${conversation}`);
    expect(title.title).toBe("Renamed by me");
    await expect(asUser(userA, (tx) => tx`select * from public.edit_last_user_message(${conversation}, ${message}, '   ')`)).rejects.toMatchObject({ code: "PT400" });
    await expect(asUser(userA, (tx) => tx`select * from public.edit_last_user_message(${conversation}, ${message}, ${"x".repeat(20_001)})`)).rejects.toMatchObject({ code: "PT400" });
    await expect(asUser(userB, (tx) => tx`select * from public.edit_last_user_message(${conversation}, ${message}, 'not mine')`)).rejects.toMatchObject({ code: "PT404" });
    await asUser(userA, (tx) => tx`select * from public.claim_assistant_message(${conversation}, ${message})`);
    await expect(asUser(userA, (tx) => tx`select * from public.edit_last_user_message(${conversation}, ${message}, 'during stream')`)).rejects.toMatchObject({ code: "PT409" });
    const { conversation: other, message: first } = await answeredConversation("older");
    await asUser(userA, (tx) => tx`select * from public.append_user_message(${other}, ${randomUUID()}, 'newer')`);
    await expect(asUser(userA, (tx) => tx`select * from public.edit_last_user_message(${other}, ${first}, 'rewrite history')`)).rejects.toMatchObject({ code: "PT409" });
    const rows = await asUser(userA, (tx) => tx`select content from public.messages where conversation_id = ${other} order by position`);
    expect(rows.map((row) => row.content)).toEqual(["older", "first answer", "newer"]);
  });

  it("stores owner preferences, rejects another owner's access, and leaves conversation models alone", async () => {
    await asUser(userA, (tx) => tx`insert into public.user_preferences (user_id) values (${userA})`);
    const [created] = await asUser(userA, (tx) => tx`select preferred_name, preferred_language, default_model, response_length, response_style, about_you from public.user_preferences`);
    expect(created).toEqual({
      preferred_name: null,
      preferred_language: "auto",
      default_model: "balanced",
      response_length: "balanced",
      response_style: "natural",
      about_you: null,
    });

    const hidden = await asUser(userB, (tx) => tx`select user_id from public.user_preferences`);
    expect(hidden).toHaveLength(0);
    await expect(asUser(userB, (tx) => tx`insert into public.user_preferences (user_id, preferred_name) values (${userA}, 'nope')`)).rejects.toThrow();
    const stolen = await asUser(userB, (tx) => tx`update public.user_preferences set preferred_name = 'hijack' where user_id = ${userA} returning user_id`);
    const removed = await asUser(userB, (tx) => tx`delete from public.user_preferences where user_id = ${userA} returning user_id`);
    expect(stolen).toHaveLength(0);
    expect(removed).toHaveLength(0);
    await expect(asUser(userA, (tx) => tx`update public.user_preferences set user_id = ${userB}`)).rejects.toThrow();

    const [before] = await sql`select selected_model from public.conversations where id = ${conversationA}`;
    await asUser(userA, (tx) => tx`update public.user_preferences set preferred_language = 'id', default_model = 'fast', response_length = 'concise', response_style = 'direct', preferred_name = 'Habib', about_you = 'Builds Nibie' where user_id = ${userA}`);
    const [saved] = await asUser(userA, (tx) => tx`select preferred_language, default_model, response_length, response_style, preferred_name, about_you, updated_at from public.user_preferences`);
    expect(saved).toMatchObject({
      preferred_language: "id",
      default_model: "fast",
      response_length: "concise",
      response_style: "direct",
      preferred_name: "Habib",
      about_you: "Builds Nibie",
    });
    expect(saved.updated_at).toBeTruthy();
    const [after] = await sql`select selected_model from public.conversations where id = ${conversationA}`;
    expect(after.selected_model).toBe(before.selected_model);

    await expect(asUser(userA, (tx) => tx`update public.user_preferences set preferred_language = 'fr'`)).rejects.toThrow();
    await expect(asUser(userA, (tx) => tx`update public.user_preferences set default_model = 'turbo'`)).rejects.toThrow();
    await expect(asUser(userA, (tx) => tx`update public.user_preferences set preferred_name = ${"x".repeat(81)}`)).rejects.toThrow();
    const [still] = await asUser(userA, (tx) => tx`select preferred_language, default_model, preferred_name from public.user_preferences`);
    expect(still).toEqual({ preferred_language: "id", default_model: "fast", preferred_name: "Habib" });
  });
});
