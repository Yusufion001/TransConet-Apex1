const DOCUMENT_FIELDS = [
  "id", "type", "status", "verifiedAt", "adminApproved",
  "adminApprovedAt", "createdAt", "updatedAt",
] as const;

const VERIFICATION_FIELDS = [
  "id", "type", "verificationProvider", "providerStatus", "adminStatus",
  "adminApproved", "verifiedAt", "adminApprovedAt", "createdAt", "updatedAt",
] as const;

export function sanitizeSensitiveEventData(
  entityType: string | undefined,
  data: unknown,
): unknown {
  if (entityType !== "DOCUMENT" && entityType !== "VERIFICATION") return data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  const source = data as Record<string, unknown>;
  const fields = entityType === "DOCUMENT" ? DOCUMENT_FIELDS : VERIFICATION_FIELDS;
  const safe: Record<string, unknown> = {};

  for (const field of fields) {
    const value = source[field];
    if (value instanceof Date && Number.isFinite(value.getTime())) {
      safe[field] = value.toISOString();
    } else if (
      value === null || typeof value === "string" ||
      typeof value === "boolean" || typeof value === "number"
    ) {
      safe[field] = value;
    }
  }
  return safe;
}
