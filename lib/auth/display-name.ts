function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function personName(source: unknown): string | null {
  if (!source || typeof source !== "object") return null;
  const record = source as Record<string, unknown>;
  const direct = text(record.full_name) ?? text(record.name) ?? text(record.preferred_name);
  if (direct) return direct;
  const given = text(record.given_name);
  const family = text(record.family_name);
  if (given && family) return `${given} ${family}`;
  return given ?? family;
}

// Auth metadata only. A missing name stays missing so the caller can try preferences before the email fallback.
export function metadataDisplayName(source: unknown): string | null {
  if (!source || typeof source !== "object") return null;
  const record = source as Record<string, unknown>;
  return personName(record) ?? personName(record.user_metadata);
}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const words = local.split(/[._-]+/).filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return words.join(" ") || "Account";
}

export function accountDisplayName({ email, metadataName, preferredName }: { email: string; metadataName?: string | null; preferredName?: string | null }): string {
  return text(preferredName) ?? text(metadataName) ?? nameFromEmail(email);
}
