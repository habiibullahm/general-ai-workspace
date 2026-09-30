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

  const sql = postgres(connectionString, { max: 1 });
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
    await sql`drop table if exists public.messages cascade`;
    await sql`drop table if exists public.conversations cascade`;
    await sql`drop table if exists public.users cascade`;
    await sql`drop type if exists public.message_status cascade`;
    await sql`drop type if exists public.message_role cascade`;
    await sql`drop schema if exists auth cascade`;
    await sql`create schema auth`;
    await sql`create table auth.users (id uuid primary key)`;
    await sql`create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$`;
    await sql`do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$`;
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
});
