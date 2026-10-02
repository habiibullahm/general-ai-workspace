import { parsePreferencePatch } from "@nibie/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { readPreferences, updatePreferences } from "../../preferences/repository.js";
import { ApiError } from "../../plugins/error-handler.js";

const ownerKeys = ["user_id", "userId", "user"] as const;
const preferenceBodyLimit = 16 * 1024;

function rejectOwnerQuery(query: unknown) {
  if (!query || typeof query !== "object" || Array.isArray(query)) return;
  for (const key of ownerKeys) {
    if (key in query) throw new ApiError(400, "validation_error", "Choose a valid preference.");
  }
}

function requireUser(request: FastifyRequest) {
  if (!request.supabase || !request.auth?.userId) {
    throw new ApiError(401, "unauthorized", "Authentication required.");
  }
  return { supabase: request.supabase, userId: request.auth.userId };
}

export function registerPreferenceRoutes(app: FastifyInstance) {
  app.get("/v1/preferences", async (request) => {
    rejectOwnerQuery(request.query);
    const { supabase } = requireUser(request);
    return readPreferences(supabase);
  });

  app.patch("/v1/preferences", { bodyLimit: preferenceBodyLimit }, async (request) => {
    rejectOwnerQuery(request.query);
    const parsed = parsePreferencePatch(request.body);
    if ("error" in parsed) throw new ApiError(400, "validation_error", parsed.error);
    const { supabase, userId } = requireUser(request);
    return updatePreferences(supabase, userId, parsed.data);
  });
}
