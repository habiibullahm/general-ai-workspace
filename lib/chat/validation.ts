import { z } from "zod";

export const modelSchema = z.enum(["Fast", "Balanced", "Reasoning"]);
export type ChatModel = z.infer<typeof modelSchema>;

const conversationIdSchema = z.string().uuid();
const titleSchema = z.string().trim().min(1).max(120);
const contentSchema = z.string().trim().min(1).max(20_000);

export function validateConversationId(value: unknown) {
  return conversationIdSchema.safeParse(value);
}

export function validateTitle(value: unknown) {
  return titleSchema.safeParse(value);
}

export function validateMessage(value: unknown) {
  return contentSchema.safeParse(value);
}
