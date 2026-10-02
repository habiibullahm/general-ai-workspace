import { healthResponseSchema } from "@nibie/contracts";
import type { FastifyInstance } from "fastify";

export function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", async () => healthResponseSchema.parse({ status: "ok" }));
}
