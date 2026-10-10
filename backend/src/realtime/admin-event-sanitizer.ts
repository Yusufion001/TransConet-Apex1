const DOCUMENT_FIELDS = [
  "id",
  "type",
  "status",
  "verifiedAt",
  "adminApproved",
  "adminApprovedAt",
  "createdAt",
  "updatedAt",
] as const;

const VERIFICATION_FIELDS = [
  "id",
  "type",
  "verificationProvider",
  "providerStatus",
  "adminStatus",
  "adminApproved",
  "verifiedAt",
  "adminApprovedAt",
  "createdAt",
  "updatedAt",
] as const;

// Expose only minimal operational metadata for user profile events.
const USER_FIELDS = [
  "id",
  "nickname",
  "role",
  "status",
  "updatedAt",
] as const;

function sanitizeAllowlistedFields(
  data: unknown,
  fields: readonly string[],
): Record<string, unknown> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  const source = data as Record<string, unknown>;
  const safe: Record<string, unknown> = {};

  for (const field of fields) {
    const value = source[field];

    if (value instanceof Date) {
      if (Number.isFinite(value.getTime())) {
        safe[field] = value.toISOString();
      }
    } else if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))
    ) {
      safe[field] = value;
    }
  }

  return safe;
}

export function sanitizeSensitiveEventData(
  entityType: string | undefined,
  data: unknown,
): unknown {
  switch (entityType) {
    case "DOCUMENT":
      return sanitizeAllowlistedFields(data, DOCUMENT_FIELDS);

    case "VERIFICATION":
      return sanitizeAllowlistedFields(data, VERIFICATION_FIELDS);

    case "USER":
      return sanitizeAllowlistedFields(data, USER_FIELDS);

    default:
      // Preserve unrelated event behavior. Add entity-specific
      // allowlists before exposing other sensitive event payloads.
      return data;
  }
}
