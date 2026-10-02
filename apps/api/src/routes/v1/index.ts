import { healthResponseSchema } from "@nibie/contracts";
import type { FastifyInstance } from "fastify";

export function registerV1Routes(app: FastifyInstance) {
  app.get("/v1/health", async () => healthResponseSchema.parse({ status: "ok" }));
}
