import { healthResponseSchema } from "@nibie/contracts";
import type { FastifyInstance } from "fastify";
import { registerAccountRoutes } from "./account.js";
import { registerPreferenceRoutes } from "./preferences.js";

export function registerV1Routes(app: FastifyInstance) {
  app.get("/v1/health", async () => healthResponseSchema.parse({ status: "ok" }));
  registerPreferenceRoutes(app);
  registerAccountRoutes(app);
}
