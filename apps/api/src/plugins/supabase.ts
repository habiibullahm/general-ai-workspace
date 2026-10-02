import { SIGN_OUT_SCOPE } from "@nibie/contracts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { readVerifiedAccessToken, isPublicApiRoute } from "./auth.js";
import { ApiError } from "./error-handler.js";
import type { ApiConfig } from "./env.js";

const sessionTokens = new WeakMap<SupabaseClient, string>();

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
  const client = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
  sessionTokens.set(client, accessToken);
  return client;
}

// Revokes every refresh token for the verified caller. GoTrue's user logout endpoint accepts that caller's
// access token; the scope is the server constant, not a client field. This does not delete the Auth user.
export async function signOutGlobalSession(client: SupabaseClient): Promise<void> {
  const accessToken = sessionTokens.get(client);
  if (!accessToken) throw new ApiError(401, "unauthorized", "Authentication required.");

  let result: { error: { status?: number } | null };
  try {
    result = await client.auth.admin.signOut(accessToken, SIGN_OUT_SCOPE);
  } catch {
    throw new ApiError(503, "service_unavailable", "Sign-out is temporarily unavailable. Please try again.");
  }

  if (!result) {
    throw new ApiError(503, "service_unavailable", "Sign-out is temporarily unavailable. Please try again.");
  }
  if (!result.error) return;
  if (result.error.status === 401 || result.error.status === 403) {
    throw new ApiError(401, "unauthorized", "Authentication required.");
  }
  throw new ApiError(503, "service_unavailable", "Sign-out is temporarily unavailable. Please try again.");
}
