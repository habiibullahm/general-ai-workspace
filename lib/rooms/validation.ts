import { z } from "zod";
import { roomBriefFieldLimit, roomDescriptionLimit, roomInstructionsLimit, roomNameLimit, type RoomBriefFields, type RoomDraft, type RoomPatch } from "@/lib/rooms/types";

const singleLineControls = /[\u0000-\u001F\u007F]/;
const multilineControls = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const roomNameSchema = z.string().trim().min(1).max(roomNameLimit).refine((value) => !singleLineControls.test(value));
const roomDescriptionSchema = z.string().trim().min(1).max(roomDescriptionLimit).refine((value) => !multilineControls.test(value));
const roomInstructionsSchema = z.string().trim().min(1).max(roomInstructionsLimit).refine((value) => !multilineControls.test(value));
const briefFieldSchema = z.string().trim().min(1).max(roomBriefFieldLimit).refine((value) => !multilineControls.test(value));

const optionalText = (schema: z.ZodType<string>) => z.union([z.null(), schema]).optional();

export const roomDraftSchema = z.object({
  name: roomNameSchema,
  description: optionalText(roomDescriptionSchema),
}).strict();

export const roomPatchSchema = z.object({
  name: roomNameSchema.optional(),
  description: optionalText(roomDescriptionSchema),
  instructions: optionalText(roomInstructionsSchema),
}).strict().refine((patch) => Object.keys(patch).length > 0);

export const roomBriefSchema = z.object({
  goal: z.union([z.null(), briefFieldSchema]),
  currentFocus: z.union([z.null(), briefFieldSchema]),
  importantDecisions: z.union([z.null(), briefFieldSchema]),
  openQuestions: z.union([z.null(), briefFieldSchema]),
  next: z.union([z.null(), briefFieldSchema]),
}).strict();

function blankToNull(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? null : value;
}

function normalizeOptional(input: unknown, keys: string[]) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const patch = { ...(input as Record<string, unknown>) };
  for (const key of keys) patch[key] = blankToNull(patch[key]);
  return patch;
}

export function parseRoomDraft(input: unknown): { data: RoomDraft } | { error: string } {
  const parsed = roomDraftSchema.safeParse(normalizeOptional(input, ["description"]));
  if (!parsed.success) return { error: roomValidationMessage(parsed.error) };
  return { data: parsed.data };
}

export function parseRoomPatch(input: unknown): { data: RoomPatch } | { error: string } {
  const parsed = roomPatchSchema.safeParse(normalizeOptional(input, ["description", "instructions"]));
  if (!parsed.success) return { error: roomValidationMessage(parsed.error) };
  return { data: parsed.data };
}

export function parseRoomBrief(input: unknown): { data: RoomBriefFields } | { error: string } {
  const parsed = roomBriefSchema.safeParse(normalizeOptional(input, ["goal", "currentFocus", "importantDecisions", "openQuestions", "next"]));
  if (!parsed.success) return { error: roomValidationMessage(parsed.error) };
  return { data: parsed.data };
}

export function roomValidationMessage(error: z.ZodError): string {
  const field = error.issues[0]?.path[0];
  if (field === "name") return "Room names must be 80 characters or fewer, with no line breaks.";
  if (field === "description") return "Descriptions must be 500 characters or fewer.";
  if (field === "instructions") return "Instructions must be 2,000 characters or fewer.";
  if (field === "goal" || field === "currentFocus" || field === "importantDecisions" || field === "openQuestions" || field === "next") {
    return "Each brief section must be 500 characters or fewer.";
  }
  return "Choose a valid room.";
}
