// PostgREST uses these codes when a schema field or table is not deployed yet.
export function schemaUnavailable(error: { code?: string } | null | undefined) {
  if (!error) return false;
  return error.code === "42703" || error.code === "42P01" || error.code === "PGRST204" || error.code === "PGRST205";
}
