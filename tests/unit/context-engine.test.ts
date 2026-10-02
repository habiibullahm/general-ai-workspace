import { describe, expect, it, vi } from "vitest";
import { buildContext } from "../../lib/context/build-context";
import { CONTEXT_POLICY_TEXT, CONTEXT_POLICY_VERSION } from "../../lib/context/context-policy";
import { estimateTokens, PROTECTED_RECENT_COUNT } from "../../lib/context/token-budget";
import { resolveThreadSummary } from "../../lib/context/thread-context";
import { toProviderMessages } from "../../lib/ai/provider-messages";
import { defaultUserPreferences, type UserPreferences } from "../../lib/preferences/types";
import type { BuildContextInput, ThreadMessage, ThreadSummary } from "../../lib/context/context-types";

const capabilities = { contextWindowTokens: 16_384, maxOutputTokens: 2_048 };

function input(overrides: Partial<BuildContextInput> = {}): BuildContextInput {
  return {
    capabilities,
    preferences: defaultUserPreferences(),
    preferenceReadFailed: false,
    summary: null,
    messages: [{ role: "user", content: "hello", position: 1 }],
    currentPosition: 1,
    ...overrides,
  };
}

function messages(count: number, size = 20): ThreadMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    role: index === count - 1 || index % 2 === 0 ? "user" as const : "assistant" as const,
    content: "x".repeat(size),
    position: index + 1,
  }));
}

const summary = (coversThroughPosition: number): ThreadSummary => ({
  objective: "Ship the engine",
  importantContext: "Settings already exist",
  decisions: "No retrieval",
  completedWork: "Design",
  currentState: "Implementing",
  openQuestions: "None",
  coversThroughPosition,
  updatedAt: "2026-10-02T00:00:00.000Z",
});

describe("context engine", () => {
  it("estimates tokens as ceil(length / 4)", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });

  it("includes profile categories without their text in diagnostics", () => {
    const preferences: UserPreferences = { ...defaultUserPreferences(), preferredLanguage: "en", responseStyle: "direct", preferredName: "Habib", aboutYou: "Builds Nibie" };
    const plan = buildContext(input({ preferences, messages: [{ role: "user", content: "Explain this in detail.", position: 1 }] }));
    const profile = plan.blocks.find((block) => block.id === "profile");
    expect(profile?.text).toContain("Preferred language: English");
    expect(profile?.text).toContain("Response style: Direct");
    expect(profile?.text).toContain('Preferred name: "Habib"');
    expect(profile?.text).toContain('User-provided context: "Builds Nibie"');
    expect(profile?.text).not.toContain("default_model");
    expect(plan.diagnostics.sources[0]).toMatchObject({ state: "included", reason: "Language, style, name, and About you" });
    expect(JSON.stringify(plan.diagnostics)).not.toContain("Habib");
    expect(JSON.stringify(plan.diagnostics)).not.toContain("Builds Nibie");
    const provider = toProviderMessages(plan);
    expect(provider[0]).toEqual({ role: "system", content: CONTEXT_POLICY_TEXT });
    expect(provider.at(-1)).toEqual({ role: "user", content: "Explain this in detail." });
    expect(provider.filter((message) => message.role === "user")).toHaveLength(1);
  });

  it("omits product defaults and keeps the current message last", () => {
    const plan = buildContext(input());
    expect(plan.blocks.find((block) => block.id === "profile")?.included).toBe(false);
    expect(plan.diagnostics.sources[0].reason).toBe("No extra profile details are set.");
    expect(toProviderMessages(plan).at(-1)?.content).toBe("hello");
    expect(plan.policyVersion).toBe(CONTEXT_POLICY_VERSION);
  });

  it("does not log profile text", () => {
    const logged = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const preferences: UserPreferences = { ...defaultUserPreferences(), preferredName: "Habib", aboutYou: "Secret biography" };
    const plan = buildContext(input({ preferences }));
    const line = JSON.stringify({ estimated: plan.budget.estimatedTokens, truncated: plan.budget.truncated, included: plan.blocks.filter((block) => block.included).map((block) => block.id) });
    expect(line).not.toContain("Habib");
    expect(line).not.toContain("Secret biography");
    logged.mockRestore();
  });

  it("uses a distinct reason when preferences could not be read", () => {
    const plan = buildContext(input({ preferenceReadFailed: true }));
    expect(plan.diagnostics.sources[0].reason).toBe("Preferences couldn't be loaded, so Nibie used defaults.");
    expect(plan.blocks.find((block) => block.id === "profile")?.included).toBe(false);
  });

  it("keeps core, the current message, and the output reserve when the thread is long", () => {
    const plan = buildContext(input({ messages: messages(32, 8_000), currentPosition: 32, capabilities: { contextWindowTokens: 4_000, maxOutputTokens: 1_000 } }));
    const dialogue = toProviderMessages(plan).filter((message) => message.role !== "system");
    expect(dialogue.at(-1)?.content).toBe("x".repeat(8_000));
    expect(plan.budget.outputReserveTokens).toBe(1_000);
    expect(plan.blocks.find((block) => block.id === "core")?.included).toBe(true);
    expect(plan.budget.truncated).toBe(true);
    expect(plan.diagnostics.sources[1].reason).toBe("Older messages left out so this reply stays focused.");
  });

  it("drops whole older messages before the protected window", () => {
    const thread = messages(8, 100).map((message, index) => ({ ...message, content: `${String(index).padStart(3, "0")}${"x".repeat(97)}` }));
    const one = estimateTokens(thread[0].content);
    const output = 40;
    const windowTokens = estimateTokens(CONTEXT_POLICY_TEXT) + one * PROTECTED_RECENT_COUNT + output;
    const tight = buildContext(input({ messages: thread, currentPosition: 8, capabilities: { contextWindowTokens: windowTokens, maxOutputTokens: output } }));
    const kept = toProviderMessages(tight).filter((message) => message.role !== "system").map((message) => message.content);
    expect(kept).toEqual(thread.slice(2).map((message) => message.content));
    expect(kept.every((content) => content.length === 100)).toBe(true);
  });

  it("drops About you before reducing the protected window", () => {
    const thread = messages(3, 40);
    const about = "a".repeat(1400);
    const preferences: UserPreferences = { ...defaultUserPreferences(), aboutYou: about };
    const plan = buildContext(input({
      preferences,
      messages: thread,
      currentPosition: 3,
      capabilities: { contextWindowTokens: 16_384, maxOutputTokens: 2_048 },
    }));
    expect(plan.blocks.find((block) => block.id === "profile")?.text).toContain("User-provided context");
    const room = estimateTokens(CONTEXT_POLICY_TEXT) + thread.reduce((sum, message) => sum + estimateTokens(message.content), 0) + 100;
    const tight = buildContext(input({
      preferences,
      messages: thread,
      currentPosition: 3,
      capabilities: { contextWindowTokens: room, maxOutputTokens: 4 },
    }));
    expect(tight.blocks.find((block) => block.id === "profile")?.included).toBe(false);
    expect(toProviderMessages(tight).filter((message) => message.role !== "system")).toHaveLength(3);
  });

  it("replaces older messages with a summary that fits, and falls back when it does not", () => {
    const thread = messages(8, 40);
    const fitted = buildContext(input({ messages: thread, currentPosition: 8, summary: summary(2) }));
    expect(fitted.blocks.find((block) => block.id === "thread_summary")?.included).toBe(true);
    expect(fitted.diagnostics.sources[2].reason).toBe("Older parts of this conversation.");
    const huge = summary(2);
    huge.importantContext = "y".repeat(10_000);
    const overflow = buildContext(input({ messages: thread, currentPosition: 8, summary: huge }));
    expect(overflow.blocks.find((block) => block.id === "thread_summary")?.included).toBe(false);
    expect(overflow.diagnostics.sources[2].reason).toBe("Not used for this reply.");
    expect(toProviderMessages(overflow).some((message) => message.content === thread[0].content)).toBe(true);
  });

  it("is deterministic and preserves message order inside this thread", () => {
    const thread = [...messages(5, 30), { role: "assistant" as const, content: "later", position: 9 }, { role: "user" as const, content: "other role", position: 4 }];
    const first = buildContext(input({ messages: thread, currentPosition: 5 }));
    const second = buildContext(input({ messages: thread, currentPosition: 5 }));
    const dialogue = toProviderMessages(first).filter((message) => message.role !== "system").map((message) => message.content);
    expect(dialogue).toEqual(toProviderMessages(second).filter((message) => message.role !== "system").map((message) => message.content));
    expect(dialogue).not.toContain("later");
    expect(dialogue).toEqual(["x".repeat(30), "x".repeat(30), "x".repeat(30), "x".repeat(30), "other role", "x".repeat(30)]);
  });

  it("rejects a missing current message, malformed content, and a zero window", () => {
    expect(() => buildContext(input({ messages: [{ role: "assistant", content: "no user", position: 1 }] }))).toThrow();
    expect(() => buildContext(input({ messages: [{ role: "user", content: 4 as unknown as string, position: 1 }] }))).toThrow();
    expect(() => buildContext(input({ capabilities: { contextWindowTokens: 0, maxOutputTokens: 100 } }))).toThrow();
    try { buildContext(input({ messages: [{ role: "user", content: "secret body", position: 1 }], capabilities: { contextWindowTokens: 0, maxOutputTokens: 100 } })); } catch (error) {
      expect(String(error)).not.toContain("secret body");
    }
  });

  it("treats a null, malformed, or stale summary as absent", () => {
    expect(resolveThreadSummary(null, 4).summary).toBeNull();
    expect(resolveThreadSummary({ ...summary(1), objective: 3 as unknown as string }, 4).summary).toBeNull();
    expect(resolveThreadSummary(summary(4), 4).summary).toBeNull();
    expect(resolveThreadSummary(summary(2), 4).summary?.coversThroughPosition).toBe(2);
    const plan = buildContext(input({ summary: null, messages: messages(2, 10), currentPosition: 2 }));
    expect(plan.diagnostics.sources[2].reason).toBe("Not needed yet.");
  });

  it("builds a 32-message plan in under 15ms", () => {
    const started = Date.now();
    buildContext(input({ messages: messages(32, 200), currentPosition: 32 }));
    expect(Date.now() - started).toBeLessThan(15);
  });
});
