import { createClient } from "@supabase/supabase-js";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { ApiError } from "./error-handler.js";
import type { ApiConfig } from "./env.js";

export type VerifiedToken = { sub: string };
export type TokenVerifier = (token: string) => Promise<VerifiedToken | null>;

const publicRoutes = new Set(["GET /health", "GET /v1/health"]);

export function createSupabaseTokenVerifier(config: ApiConfig): TokenVerifier {
  return async (token) => {
    const client = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    try {
      const { data, error } = await client.auth.getClaims(token);
      const sub = data?.claims.sub;
      if (error || typeof sub !== "string" || !sub) return null;
      return { sub };
    } catch {
      return null;
    }
  };
}

export function registerAuth(app: FastifyInstance, verifyToken: TokenVerifier) {
  app.decorateRequest("auth", null);

  app.addHook("onRequest", async (request) => {
    request.auth = null;
  });

  app.addHook("onRoute", (routeOptions) => {
    if (isPublicRouteOptions(routeOptions.method, routeOptions.url)) return;

    const authenticate = async (request: FastifyRequest) => {
      const token = bearerToken(request.headers.authorization);
      if (!token) throw new ApiError(401, "unauthorized", "Authentication required.");

      let verified: VerifiedToken | null = null;
      try {
        verified = await verifyToken(token);
      } catch {
        verified = null;
      }

      if (!verified?.sub) throw new ApiError(401, "unauthorized", "Authentication required.");
      request.auth = { userId: verified.sub };
    };

    const current = routeOptions.preHandler;
    if (!current) {
      routeOptions.preHandler = authenticate;
      return;
    }

    const handlers = Array.isArray(current) ? current : [current];
    routeOptions.preHandler = [...handlers, authenticate];
  });
}

function isPublicRouteOptions(method: string | string[], url: string) {
  const methods = Array.isArray(method) ? method : [method];
  return methods.every((item) => publicRoutes.has(`${item} ${url}`));
}

function bearerToken(header: string | undefined) {
  if (!header) return null;
  const [scheme, token, extra] = header.split(" ");
  if (scheme !== "Bearer" || !token || extra !== undefined) return null;
  return token;
}
