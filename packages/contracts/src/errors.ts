import { z } from "zod";

export const errorCodeSchema = z.enum([
  "validation_error",
  "unauthorized",
  "forbidden",
  "origin_rejected",
  "not_found",
  "internal_error",
  "conflict",
  "unsupported_media_type",
  "bad_gateway",
  "service_unavailable",
]);

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    requestId: z.uuid(),
  }),
});

export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
