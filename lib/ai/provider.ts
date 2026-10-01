import "server-only";

import type { ChatModel } from "@/lib/chat/validation";
import type { ReasoningEffort } from "@/lib/chat/models";
import { getAiConfig, resolveLogicalModel } from "./registry";

export type ProviderMessage = { role: "user" | "assistant"; content: string };
// `reasoning` is only ever passed after the route has checked it against the server-side allowlist; "auto" sends nothing.
export type StreamOptions = { reasoning?: ReasoningEffort };
export type ChatProvider = { stream(model: ChatModel, messages: ProviderMessage[], signal: AbortSignal, options?: StreamOptions): Promise<ReadableStream<Uint8Array>> };

export const openAiCompatibleProvider: ChatProvider = {
  async stream(logicalModel, messages, signal, options = {}) {
    const config = getAiConfig();
    const reasoning = options.reasoning && options.reasoning !== "auto" ? { reasoning_effort: options.reasoning } : {};
    let response: Response;
    try {
      response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST", signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({ model: resolveLogicalModel(logicalModel, config), messages, stream: true, ...reasoning }),
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new Error("AI provider request failed.");
    }
    if (!response.ok || !response.body) throw new Error("AI provider request failed.");
    return response.body;
  },
};

export const chatProvider: ChatProvider = openAiCompatibleProvider;
