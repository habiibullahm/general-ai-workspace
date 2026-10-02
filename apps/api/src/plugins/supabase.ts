import { createClient } from "@supabase/supabase-js";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ApiConfig } from "./env.js";

export function registerSupabase(app: FastifyInstance, config: ApiConfig) {
  app.decorateRequest("createUserClient", null as FastifyRequest["createUserClient"]);

  app.addHook("onRequest", async (request, reply) => {
    if (reply.sent) return;
    request.createUserClient = (jwt: string) =>
      createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: { Authorization: `Bearer ${jwt}` },
        },
      });
  });
}
