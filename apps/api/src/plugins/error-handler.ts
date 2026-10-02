import { errorEnvelopeSchema, type ErrorCode } from "@nibie/contracts";
import type { FastifyError, FastifyInstance, FastifyReply } from "fastify";

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;

  constructor(statusCode: number, code: ErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const safeMessages = {
  validation_error: "Invalid request.",
  unauthorized: "Authentication required.",
  forbidden: "Forbidden.",
  origin_rejected: "Origin is not allowed.",
  not_found: "Not found.",
  internal_error: "Something went wrong.",
} as const;

export function registerErrorHandler(app: FastifyInstance) {
  app.setNotFoundHandler((request, reply) => {
    sendError(reply, request.id, 404, "not_found");
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof ApiError) {
      sendError(reply, request.id, error.statusCode, error.code, error.message);
      return;
    }

    if (error.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE" || error.statusCode === 415) {
      sendError(reply, request.id, 415, "unsupported_media_type", "A JSON request is required.");
      return;
    }

    if (error.code === "FST_ERR_CTP_BODY_TOO_LARGE" || error.statusCode === 413) {
      sendError(reply, request.id, 400, "validation_error");
      return;
    }

    if (error.validation || error.code === "FST_ERR_CTP_INVALID_JSON" || error.statusCode === 400) {
      sendError(reply, request.id, 400, "validation_error");
      return;
    }

    request.log.error({ requestId: request.id, message: "request failed" });
    sendError(reply, request.id, 500, "internal_error");
  });
}

function sendError(
  reply: FastifyReply,
  requestId: string,
  statusCode: number,
  code: ErrorCode,
  message?: string,
) {
  const text = message ?? (code in safeMessages ? safeMessages[code as keyof typeof safeMessages] : safeMessages.internal_error);
  const body = errorEnvelopeSchema.parse({
    error: { code, message: text, requestId: String(requestId) },
  });
  reply.header("x-request-id", String(requestId));
  return reply.status(statusCode).send(body);
}
