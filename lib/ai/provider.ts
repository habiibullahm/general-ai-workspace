import "server-only";

import type { ChatModel } from "@/lib/chat/validation";
import { getAiConfig, resolveLogicalModel } from "./registry";

export type ProviderMessage = { role: "user" | "assistant"; content: string };
export type ChatProvider = { stream(model: ChatModel, messages: ProviderMessage[], signal: AbortSignal): Promise<ReadableStream<Uint8Array>> };

export const openAiCompatibleProvider: ChatProvider = {
  async stream(logicalModel, messages, signal) {
    const config = getAiConfig();
    let response: Response;
    try {
      response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST", signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({ model: resolveLogicalModel(logicalModel, config), messages, stream: true }),
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
