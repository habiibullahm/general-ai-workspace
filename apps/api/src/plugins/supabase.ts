import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { readVerifiedAccessToken, isPublicApiRoute } from "./auth.js";
import { ApiError } from "./error-handler.js";
import type { ApiConfig } from "./env.js";

export function registerSupabase(app: FastifyInstance, config: ApiConfig) {
  app.decorateRequest("supabase", null as FastifyRequest["supabase"]);

  app.addHook("onRoute", (routeOptions) => {
    if (isPublicApiRoute(routeOptions.method, routeOptions.url)) return;

    const attachClient = async (request: FastifyRequest) => {
      if (request.supabase) return;

      const accessToken = readVerifiedAccessToken(request);
      if (!accessToken || !request.auth?.userId) {
        throw new ApiError(401, "unauthorized", "Authentication required.");
      }

      request.supabase = createUserSupabaseClient(config, accessToken);
    };

    const current = routeOptions.preHandler;
    if (!current) {
      routeOptions.preHandler = attachClient;
      return;
    }

    const handlers = Array.isArray(current) ? current : [current];
    routeOptions.preHandler = [...handlers, attachClient];
  });
}

function createUserSupabaseClient(config: ApiConfig, accessToken: string): SupabaseClient {
  return createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}
