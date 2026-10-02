import type { SupabaseClient } from "@supabase/supabase-js";
import type { Writable } from "node:stream";
import Fastify from "fastify";
import { createSupabaseTokenVerifier, registerAuth, type TokenVerifier } from "./plugins/auth.js";
import { registerCors } from "./plugins/cors.js";
import { readApiEnv, type ApiConfig } from "./plugins/env.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerRequestId, requestIdFrom } from "./plugins/request-id.js";
import { registerSupabase } from "./plugins/supabase.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerV1Routes } from "./routes/v1/index.js";

declare module "fastify" {
  interface FastifyRequest {
    auth: { userId: string } | null;
    supabase: SupabaseClient | null;
  }

  interface FastifyInstance {
    apiConfig: ApiConfig;
  }
}

export type BuildAppOptions = {
  env: Record<string, string | undefined>;
  verifyToken?: TokenVerifier;
  logStream?: Writable;
};

export async function buildApp(options: BuildAppOptions) {
  const config = readApiEnv(options.env);
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...(options.logStream ? { stream: options.logStream } : {}),
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.headers['x-api-key']",
          "res.headers['set-cookie']",
        ],
        censor: "[redacted]",
      },
    },
    disableRequestLogging: true,
    genReqId: requestIdFrom,
    requestIdHeader: false,
  });

  app.removeContentTypeParser("text/plain");
  app.decorate("apiConfig", config);
  registerRequestId(app);
  registerErrorHandler(app);
  registerCors(app, config);
  registerAuth(app, options.verifyToken ?? createSupabaseTokenVerifier(config));
  registerSupabase(app, config);
  registerHealthRoutes(app);
  registerV1Routes(app);

  app.addHook("onResponse", async (request, reply) => {
    request.log.info({
      requestId: request.id,
      method: request.method,
      path: request.url.split("?")[0],
      status: reply.statusCode,
      duration: reply.elapsedTime,
    });
  });

  return app;
}
