import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { FastifyInstance } from "fastify";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function resolveRequestId(header: string | string[] | undefined) {
  const value = Array.isArray(header) ? header[0] : header;
  if (value && uuidPattern.test(value)) return value;
  return randomUUID();
}

export function requestIdFrom(request: IncomingMessage) {
  return resolveRequestId(request.headers["x-request-id"]);
}

export function registerRequestId(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });
}
