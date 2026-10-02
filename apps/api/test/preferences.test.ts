import { readFileSync } from "node:fs";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildTestApp, expectUuid, validEnv } from "./fixture.js";

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

type PreferenceRow = {
  preferred_name: string | null;
  preferred_language: string;
  default_model: string;
  response_length: string;
  response_style: string;
  about_you: string | null;
  created_at: string;
  updated_at: string;
};

type DbError = { code: string; message: string };

type ClientCall = {
  url: string;
  key: string;
  authorization: string | undefined;
  persistSession: boolean | undefined;
  autoRefreshToken: boolean | undefined;
  detectSessionInUrl: boolean | undefined;
};

type Operation = {
  token: string;
  table: string;
  method: "select" | "upsert";
  columns?: string;
  payload?: Record<string, unknown>;
  onConflict?: string;
};

const sessions = new Map<string, string>();
const rows = new Map<string, PreferenceRow | null>();
const operations: Operation[] = [];
const clientCalls: ClientCall[] = [];
let forcedError: DbError | null = null;

const preferenceColumns = "preferred_name,preferred_language,default_model,response_length,response_style,about_you,created_at,updated_at";

function emptyRow(): PreferenceRow {
  return {
    preferred_name: null,
    preferred_language: "auto",
    default_model: "balanced",
    response_length: "balanced",
    response_style: "natural",
    about_you: null,
    created_at: "2026-10-02T00:00:00.000Z",
    updated_at: "2026-10-02T00:00:00.000Z",
  };
}

function bearerFrom(authorization: string | undefined) {
  if (!authorization?.startsWith("Bearer ")) return "";
  return authorization.slice("Bearer ".length);
}

function installClient(token: string) {
  return {
    from(table: string) {
      return {
        select(columns: string) {
          return {
            maybeSingle: async () => {
              operations.push({ token, table, method: "select", columns });
              if (forcedError) return { data: null, error: forcedError };
              return { data: rows.get(token) ?? null, error: null };
            },
          };
        },
        upsert(payload: Record<string, unknown>, options?: { onConflict?: string }) {
          operations.push({ token, table, method: "upsert", payload, onConflict: options?.onConflict });
          return {
            select(columns: string) {
              return {
                single: async () => {
                  operations.push({ token, table, method: "select", columns });
                  if (forcedError) return { data: null, error: forcedError };
                  const next: PreferenceRow = { ...(rows.get(token) ?? emptyRow()), updated_at: "2026-10-02T00:00:01.000Z" };
                  if ("preferred_name" in payload) next.preferred_name = payload.preferred_name as string | null;
                  if ("preferred_language" in payload) next.preferred_language = String(payload.preferred_language);
                  if ("default_model" in payload) next.default_model = String(payload.default_model);
                  if ("response_length" in payload) next.response_length = String(payload.response_length);
                  if ("response_style" in payload) next.response_style = String(payload.response_style);
                  if ("about_you" in payload) next.about_you = payload.about_you as string | null;
                  rows.set(token, next);
                  return { data: next, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
}

const verifyToken = vi.fn(async (token: string) => {
  const sub = sessions.get(token);
  return sub ? { sub } : null;
});

function source(relative: string) {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

async function buildPreferencesApp(env: Record<string, string | undefined> = validEnv, logStream?: Writable) {
  return buildTestApp(env, verifyToken, logStream ? { logStream } : undefined);
}

beforeEach(() => {
  sessions.clear();
  rows.clear();
  operations.length = 0;
  clientCalls.length = 0;
  forcedError = null;
  sessions.set("valid-token", "user-123");
  verifyToken.mockClear();
  createClientMock.mockReset();
  createClientMock.mockImplementation((url: string, key: string, options: {
    auth?: { persistSession?: boolean; autoRefreshToken?: boolean; detectSessionInUrl?: boolean };
    global?: { headers?: { Authorization?: string } };
  }) => {
    const authorization = options?.global?.headers?.Authorization;
    clientCalls.push({
      url,
      key,
      authorization,
      persistSession: options?.auth?.persistSession,
      autoRefreshToken: options?.auth?.autoRefreshToken,
      detectSessionInUrl: options?.auth?.detectSessionInUrl,
    });
    return installClient(bearerFrom(authorization));
  });
});

describe("preferences auth", () => {
  it("rejects GET and PATCH without a bearer token", async () => {
    const app = await buildPreferencesApp();
    const getResponse = await app.inject({ method: "GET", url: "/v1/preferences" });
    const patchResponse = await app.inject({
      method: "PATCH",
      url: "/v1/preferences",
      payload: { preferredLanguage: "en" },
    });

    expect(getResponse.statusCode).toBe(401);
    expect(patchResponse.statusCode).toBe(401);
    expect(getResponse.json().error.code).toBe("unauthorized");
    expect(patchResponse.json().error.code).toBe("unauthorized");
    expect(getResponse.json().error.requestId).toBe(getResponse.headers["x-request-id"]);
    expect(verifyToken).not.toHaveBeenCalled();
    expect(createClientMock).not.toHaveBeenCalled();
    expect(operations).toEqual([]);
    await app.close();
  });

  it("rejects a malformed or invalid bearer token", async () => {
    const app = await buildPreferencesApp();
    const malformed = await app.inject({
      method: "GET",
      url: "/v1/preferences",
      headers: { authorization: "Token valid-token" },
    });
    const invalid = await app.inject({
      method: "PATCH",
      url: "/v1/preferences",
      headers: { authorization: "Bearer wrong-token extra" },
      payload: { preferredLanguage: "en" },
    });
    const rejected = await app.inject({
      method: "GET",
      url: "/v1/preferences",
      headers: { authorization: "Bearer wrong-token" },
    });

    expect(malformed.statusCode).toBe(401);
    expect(invalid.statusCode).toBe(401);
    expect(rejected.statusCode).toBe(401);
    expect(malformed.json().error.message).toBe("Authentication required.");
    expect(createClientMock).not.toHaveBeenCalled();
    expect(operations).toEqual([]);
    await app.close();
  });

  it("establishes the owner from the verified token and builds one user client with that bearer", async () => {
    const app = await buildPreferencesApp();
    app.get("/__test/client-binding", async (request) => ({
      userId: request.auth?.userId ?? null,
      factory: typeof (request as { createUserClient?: (jwt: string) => unknown }).createUserClient,
    }));

    const response = await app.inject({
      method: "GET",
      url: "/__test/client-binding",
      headers: {
        authorization: "Bearer valid-token",
        "x-access-token": "attacker-token",
        "x-user-id": "attacker-id",
      },
      payload: { jwt: "attacker-token", accessToken: "attacker-token", user_id: "attacker-id" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ userId: "user-123", factory: "undefined" });
    expect(verifyToken).toHaveBeenCalledTimes(1);
    expect(verifyToken).toHaveBeenCalledWith("valid-token");
    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(clientCalls[0]).toMatchObject({
      url: validEnv.SUPABASE_URL,
      key: validEnv.SUPABASE_PUBLISHABLE_KEY,
      authorization: "Bearer valid-token",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    });
    expect(clientCalls[0]?.authorization).not.toContain("attacker-token");
    expect(JSON.stringify(clientCalls)).not.toContain("service_role");
    await app.close();
  });
});

describe("preferences ownership", () => {
  it("ignores body, query, and header owner selectors", async () => {
    const app = await buildPreferencesApp();
    const response = await app.inject({
      method: "PATCH",
      url: "/v1/preferences?user_id=attacker-id&userId=attacker-id&user=attacker-id",
      headers: {
        authorization: "Bearer valid-token",
        "x-user-id": "attacker-id",
      },
      payload: { preferredLanguage: "en", user_id: "attacker-id", userId: "attacker-id", user: "attacker-id" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("validation_error");
    expect(operations.some((operation) => operation.method === "upsert")).toBe(false);
    expect(JSON.stringify(response.json())).not.toContain("attacker-id");
    await app.close();
  });

  it("writes only the verified subject and reads only that caller's client row", async () => {
    sessions.set("token-b", "user-b");
    rows.set("valid-token", {
      ...emptyRow(),
      preferred_name: "Habib",
      preferred_language: "id",
      created_at: "2026-10-02T00:00:00.000Z",
      updated_at: "2026-10-02T00:00:00.000Z",
    });
    rows.set("token-b", {
      ...emptyRow(),
      preferred_name: "Other",
      preferred_language: "en",
    });
    const app = await buildPreferencesApp();

    const own = await app.inject({
      method: "GET",
      url: "/v1/preferences?preferredName=Other",
      headers: { authorization: "Bearer valid-token", "x-user-id": "user-b" },
    });
    const other = await app.inject({
      method: "GET",
      url: "/v1/preferences",
      headers: { authorization: "Bearer token-b" },
    });
    const patch = await app.inject({
      method: "PATCH",
      url: "/v1/preferences",
      headers: { authorization: "Bearer valid-token" },
      payload: { preferredName: "user-b", responseStyle: "direct" },
    });

    expect(own.statusCode).toBe(200);
    expect(own.json().preferredName).toBe("Habib");
    expect(other.json().preferredName).toBe("Other");
    expect(patch.statusCode).toBe(200);
    expect(patch.json().preferredName).toBe("user-b");
    const upserts = operations.filter((operation) => operation.method === "upsert");
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({ token: "valid-token", table: "user_preferences", onConflict: "user_id" });
    expect(upserts[0]?.payload).toEqual({ user_id: "user-123", preferred_name: "user-b", response_style: "direct" });
    expect(operations.every((operation) => operation.table === "user_preferences")).toBe(true);
    expect(operations.every((operation) => operation.columns === undefined || operation.columns === preferenceColumns)).toBe(true);
    await app.close();
  });
});

describe("preferences read", () => {
  it("returns canonical defaults when the owner has no row", async () => {
    const app = await buildPreferencesApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/preferences",
      headers: { authorization: "Bearer valid-token" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      preferredName: null,
      preferredLanguage: "auto",
      defaultModel: "balanced",
      responseLength: "balanced",
      responseStyle: "natural",
      aboutYou: null,
      createdAt: null,
      updatedAt: null,
    });
    expect(operations.map((operation) => operation.method)).toEqual(["select"]);
    expect(response.json().user_id).toBeUndefined();
    await app.close();
  });

  it("returns the stored preference shape for the authenticated caller", async () => {
    rows.set("valid-token", {
      preferred_name: "Habib",
      preferred_language: "id",
      default_model: "fast",
      response_length: "concise",
      response_style: "direct",
      about_you: "Builds Nibie",
      created_at: "2026-10-02T00:00:00.000Z",
      updated_at: "2026-10-02T00:00:01.000Z",
    });
    const app = await buildPreferencesApp();
    const requestId = "6f1c2b4e-8a0d-4e2b-9c1a-0b7e5d3a1f20";
    const response = await app.inject({
      method: "GET",
      url: "/v1/preferences",
      headers: { authorization: "Bearer valid-token", "x-request-id": requestId },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-request-id"]).toBe(requestId);
    expect(response.json()).toEqual({
      preferredName: "Habib",
      preferredLanguage: "id",
      defaultModel: "fast",
      responseLength: "concise",
      responseStyle: "direct",
      aboutYou: "Builds Nibie",
      createdAt: "2026-10-02T00:00:00.000Z",
      updatedAt: "2026-10-02T00:00:01.000Z",
    });
    await app.close();
  });

  it("hides database failures", async () => {
    forcedError = { code: "XX000", message: "relation user_preferences does not exist" };
    const app = await buildPreferencesApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/preferences",
      headers: { authorization: "Bearer valid-token" },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json().error).toEqual({
      code: "internal_error",
      message: "Something went wrong.",
      requestId: response.headers["x-request-id"],
    });
    expect(JSON.stringify(response.json())).not.toContain("user_preferences");
    expect(JSON.stringify(response.json())).not.toContain("relation");
    await app.close();
  });
});

describe("preferences update", () => {
  it("applies a partial update and a multi-field update for the verified owner", async () => {
    rows.set("valid-token", {
      ...emptyRow(),
      preferred_name: "Habib",
      preferred_language: "en",
      about_you: "Builds Nibie",
    });
    const app = await buildPreferencesApp();
    const partial = await app.inject({
      method: "PATCH",
      url: "/v1/preferences",
      headers: { authorization: "Bearer valid-token" },
      payload: { responseStyle: "professional" },
    });
    const many = await app.inject({
      method: "PATCH",
      url: "/v1/preferences",
      headers: { authorization: "Bearer valid-token" },
      payload: {
        preferredLanguage: "id",
        defaultModel: "reasoning",
        responseLength: "detailed",
        responseStyle: "direct",
        preferredName: "  Habib  ",
        aboutYou: "  Builds Nibie  ",
      },
    });

    expect(partial.statusCode).toBe(200);
    expect(partial.json()).toMatchObject({
      preferredName: "Habib",
      preferredLanguage: "en",
      responseStyle: "professional",
      aboutYou: "Builds Nibie",
    });
    expect(many.statusCode).toBe(200);
    expect(many.json()).toMatchObject({
      preferredName: "Habib",
      preferredLanguage: "id",
      defaultModel: "reasoning",
      responseLength: "detailed",
      responseStyle: "direct",
      aboutYou: "Builds Nibie",
    });
    const upserts = operations.filter((operation) => operation.method === "upsert");
    expect(upserts[0]?.payload).toEqual({ user_id: "user-123", response_style: "professional" });
    expect(upserts[1]?.payload).toEqual({
      user_id: "user-123",
      preferred_language: "id",
      default_model: "reasoning",
      response_length: "detailed",
      response_style: "direct",
      preferred_name: "Habib",
      about_you: "Builds Nibie",
    });
    expect(verifyToken).toHaveBeenCalledTimes(2);
    expect(createClientMock).toHaveBeenCalledTimes(2);
    await app.close();
  });

  it("rejects unknown fields, invalid enums, invalid lengths, and empty patches", async () => {
    const app = await buildPreferencesApp();
    const cases = [
      [{}, "Choose a valid preference."],
      [{ theme: "dark" }, "Choose a valid preference."],
      [{ user_id: "attacker-id", preferredLanguage: "en" }, "Choose a valid preference."],
      [{ userId: "attacker-id", preferredLanguage: "en" }, "Choose a valid preference."],
      [{ user: "attacker-id", preferredLanguage: "en" }, "Choose a valid preference."],
      [{ createdAt: "2026-10-02T00:00:00.000Z" }, "Choose a valid preference."],
      [{ preferredLanguage: "fr" }, "Choose a valid preference."],
      [{ preferredLanguage: "English" }, "Choose a valid preference."],
      [{ defaultModel: "Fast" }, "Choose a valid preference."],
      [{ defaultModel: "gpt-4.1" }, "Choose a valid preference."],
      [{ defaultModel: "openai/gpt-4o" }, "Choose a valid preference."],
      [{ responseLength: "short" }, "Choose a valid preference."],
      [{ responseStyle: "friendly" }, "Choose a valid preference."],
      [{ preferredName: "x".repeat(81) }, "Preferred name must be 80 characters or fewer, with no line breaks."],
      [{ preferredName: "Ha\nbib" }, "Preferred name must be 80 characters or fewer, with no line breaks."],
      [{ aboutYou: "x".repeat(1501) }, "About you must be 1,500 characters or fewer."],
    ] as const;

    for (const [payload, message] of cases) {
      const response = await app.inject({
        method: "PATCH",
        url: "/v1/preferences",
        headers: { authorization: "Bearer valid-token", "x-request-id": "6f1c2b4e-8a0d-4e2b-9c1a-0b7e5d3a1f20" },
        payload,
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("validation_error");
      expect(response.json().error.message).toBe(message);
      expect(response.json().error.requestId).toBe("6f1c2b4e-8a0d-4e2b-9c1a-0b7e5d3a1f20");
    }

    expect(operations.some((operation) => operation.method === "upsert")).toBe(false);
    await app.close();
  });

  it("trims text and clears blank name and about you", async () => {
    const app = await buildPreferencesApp();
    const trimmed = await app.inject({
      method: "PATCH",
      url: "/v1/preferences",
      headers: { authorization: "Bearer valid-token" },
      payload: { preferredName: "  Habib  ", aboutYou: "  Builds\nNibie  " },
    });
    const cleared = await app.inject({
      method: "PATCH",
      url: "/v1/preferences",
      headers: { authorization: "Bearer valid-token" },
      payload: { preferredName: "   ", aboutYou: "\n" },
    });

    expect(trimmed.statusCode).toBe(200);
    expect(trimmed.json().preferredName).toBe("Habib");
    expect(trimmed.json().aboutYou).toBe("Builds\nNibie");
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json().preferredName).toBeNull();
    expect(cleared.json().aboutYou).toBeNull();
    const upserts = operations.filter((operation) => operation.method === "upsert");
    expect(upserts[0]?.payload).toMatchObject({ preferred_name: "Habib", about_you: "Builds\nNibie" });
    expect(upserts[1]?.payload).toMatchObject({ preferred_name: null, about_you: null });
    await app.close();
  });

  it("accepts a name at the current limit and rejects a non-JSON patch", async () => {
    const app = await buildPreferencesApp();
    const named = await app.inject({
      method: "PATCH",
      url: "/v1/preferences",
      headers: { authorization: "Bearer valid-token" },
      payload: { preferredName: "x".repeat(80), aboutYou: "y".repeat(1500) },
    });
    const text = await app.inject({
      method: "PATCH",
      url: "/v1/preferences",
      headers: { authorization: "Bearer valid-token", "content-type": "text/plain" },
      payload: "preferredName=Habib",
    });
    const broken = await app.inject({
      method: "PATCH",
      url: "/v1/preferences",
      headers: { authorization: "Bearer valid-token", "content-type": "application/json" },
      payload: "{\"preferredName\": \"PreferredNameDoNotLog\"",
    });

    expect(named.statusCode).toBe(200);
    expect(named.json().preferredName).toHaveLength(80);
    expect(named.json().aboutYou).toHaveLength(1500);
    expect(text.statusCode).toBe(415);
    expect(text.json().error.code).toBe("unsupported_media_type");
    expect(text.json().error.message).toBe("A JSON request is required.");
    expect(broken.statusCode).toBe(400);
    expect(broken.json().error.code).toBe("validation_error");
    expect(JSON.stringify(broken.json())).not.toContain("PreferredNameDoNotLog");
    await app.close();
  });

  it("does not add put or delete and maps a forbidden database write without policy text", async () => {
    const app = await buildPreferencesApp();
    const put = await app.inject({
      method: "PUT",
      url: "/v1/preferences",
      headers: { authorization: "Bearer valid-token" },
      payload: { preferredLanguage: "en" },
    });
    const deleted = await app.inject({
      method: "DELETE",
      url: "/v1/preferences",
      headers: { authorization: "Bearer valid-token" },
    });
    forcedError = { code: "42501", message: "new row violates row-level security policy for user_preferences" };
    const forbidden = await app.inject({
      method: "PATCH",
      url: "/v1/preferences",
      headers: { authorization: "Bearer valid-token" },
      payload: { preferredLanguage: "en" },
    });

    expect(put.statusCode).toBe(404);
    expect(deleted.statusCode).toBe(404);
    expect(put.json().error.code).toBe("not_found");
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json().error.code).toBe("forbidden");
    expect(forbidden.json().error.message).toBe("Forbidden.");
    expect(JSON.stringify(forbidden.json())).not.toMatch(/policy|user_preferences|row-level/i);
    await app.close();
  });
});

describe("preferences privacy", () => {
  it("does not log preference values, tokens, cookies, or request bodies", async () => {
    sessions.set("preference-token-do-not-log", "user-123");
    const lines: string[] = [];
    const logStream = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(String(chunk));
        callback();
      },
    });
    const app = await buildPreferencesApp({ ...validEnv, LOG_LEVEL: "info" }, logStream);
    const response = await app.inject({
      method: "PATCH",
      url: "/v1/preferences?ignored=AboutYouDoNotLogSecret",
      headers: {
        authorization: "Bearer preference-token-do-not-log",
        cookie: "sb-access-token=cookie-do-not-log",
        "x-request-id": "6f1c2b4e-8a0d-4e2b-9c1a-0b7e5d3a1f20",
      },
      payload: {
        preferredName: "PreferredNameDoNotLog",
        aboutYou: "AboutYouDoNotLogSecret",
      },
    });

    const logs = lines.join("\n");
    expect(response.statusCode).toBe(200);
    expect(response.json().preferredName).toBe("PreferredNameDoNotLog");
    expect(logs).toContain("\"requestId\":\"6f1c2b4e-8a0d-4e2b-9c1a-0b7e5d3a1f20\"");
    expect(logs).toContain("\"method\":\"PATCH\"");
    expect(logs).toContain("\"path\":\"/v1/preferences\"");
    expect(logs).toContain("\"status\":200");
    expect(logs).not.toContain("preference-token-do-not-log");
    expect(logs).not.toContain("cookie-do-not-log");
    expect(logs).not.toContain("PreferredNameDoNotLog");
    expect(logs).not.toContain("AboutYouDoNotLogSecret");
    expect(logs).not.toContain("preferredName");
    expect(logs).not.toContain("aboutYou");
    expect(logs).not.toContain("preferred_name");
    expect(logs).not.toContain("about_you");
    expect(logs).not.toContain("ignored=");
    await app.close();
  });
});

describe("preferences health regression", () => {
  it("leaves health probes public, local, and under the inject budget", async () => {
    const app = await buildPreferencesApp();
    await app.inject({ method: "GET", url: "/health" });
    const samples: number[] = [];

    for (const url of ["/health", "/v1/health", "/health", "/v1/health", "/health"] as const) {
      const started = performance.now();
      const response = await app.inject({ method: "GET", url });
      samples.push(performance.now() - started);
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok" });
      expectUuid(response.headers["x-request-id"]);
    }

    samples.sort((left, right) => left - right);
    const median = samples[Math.floor(samples.length / 2)] ?? samples[0];
    const preferenceStarted = performance.now();
    const preference = await app.inject({
      method: "GET",
      url: "/v1/preferences",
      headers: { authorization: "Bearer valid-token" },
    });
    const preferenceMs = performance.now() - preferenceStarted;
    process.stdout.write(`inject median /health ${median.toFixed(2)}ms stubbed /v1/preferences ${preferenceMs.toFixed(2)}ms\n`);

    expect(median).toBeLessThan(20);
    expect(preference.statusCode).toBe(200);
    expect(verifyToken).toHaveBeenCalledTimes(1);
    expect(createClientMock).toHaveBeenCalledTimes(1);
    await app.close();
  });
});

describe("preferences security boundary", () => {
  it("keeps privileged database access and caller JWT injection out of the route", () => {
    const route = source("../src/routes/v1/preferences.ts");
    const repository = source("../src/preferences/repository.ts");
    const supabase = source("../src/plugins/supabase.ts");
    const auth = source("../src/plugins/auth.ts");
    const product = `${route}\n${repository}`;

    expect(product).not.toMatch(/service_role|DATABASE_URL|AI_API_KEY|sb_secret_|createClient|createUserClient|getClaims|conversations|drizzle|postgres/);
    expect(route).not.toMatch(/readVerifiedAccessToken|Authorization|accessToken/);
    expect(supabase).not.toContain("createUserClient");
    expect(supabase).not.toMatch(/export function createUserSupabaseClient/);
    expect(supabase).toContain("readVerifiedAccessToken");
    expect(auth).not.toContain("request.body");
    expect(auth).not.toContain("user_id");
  });

  it("rejects an oversized preference body without echoing it", async () => {
    const lines: string[] = [];
    const logStream = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(String(chunk));
        callback();
      },
    });
    const app = await buildPreferencesApp({ ...validEnv, LOG_LEVEL: "info" }, logStream);
    const response = await app.inject({
      method: "PATCH",
      url: "/v1/preferences",
      headers: { authorization: "Bearer valid-token" },
      payload: { aboutYou: `AboutYouDoNotLogSecret${"x".repeat(20_000)}` },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("validation_error");
    expect(JSON.stringify(response.json())).not.toContain("AboutYouDoNotLogSecret");
    expect(lines.join("\n")).not.toContain("AboutYouDoNotLogSecret");
    await app.close();
  });
});
