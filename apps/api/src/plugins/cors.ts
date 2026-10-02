import type { FastifyInstance } from "fastify";
import { ApiError } from "./error-handler.js";
import type { ApiConfig } from "./env.js";

export function registerCors(app: FastifyInstance, config: ApiConfig) {
  const allowlist = new Set(config.origins);

  app.addHook("onRequest", async (request, reply) => {
    const originHeader = request.headers.origin;
    if (!originHeader) return;

    const origin = Array.isArray(originHeader) ? undefined : originHeader;
    if (!origin || !allowlist.has(origin)) {
      throw new ApiError(403, "origin_rejected", "Origin is not allowed.");
    }

    reply.header("Access-Control-Allow-Origin", origin);
    reply.header("Vary", "Origin");
    reply.header("Access-Control-Allow-Headers", "Authorization, Content-Type, x-request-id");
    reply.header("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");

    if (request.method === "OPTIONS") {
      return reply.status(204).send();
    }
  });
}
