import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeSensitiveEventData } from "../src/realtime/admin-event-sanitizer.js";

test("document events exclude private document fields", () => {
  const result = sanitizeSensitiveEventData("DOCUMENT", {
    id: "doc-1", type: "IDENTITY_DOCUMENT", status: "PENDING",
    fileUrl: "private-url", storagePath: "private-path",
    verificationNumber: "12345678901",
    providerResponse: { secret: "provider-secret" },
  });
  assert.deepEqual(result, {
    id: "doc-1", type: "IDENTITY_DOCUMENT", status: "PENDING",
  });
  assert.equal(JSON.stringify(result).includes("provider-secret"), false);
});

test("verification events exclude identity numbers and provider responses", () => {
  const result = sanitizeSensitiveEventData("VERIFICATION", {
    id: "ver-1", type: "NIN", verificationProvider: "YOUVERIFY",
    providerStatus: "SUCCESS", adminStatus: "PENDING",
    verificationNumber: "12345678901",
    providerResponse: { secret: "provider-secret" },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  assert.deepEqual(result, {
    id: "ver-1", type: "NIN", verificationProvider: "YOUVERIFY",
    providerStatus: "SUCCESS", adminStatus: "PENDING",
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(JSON.stringify(result).includes("12345678901"), false);
});

test("user events exclude private profile fields", () => {
  const result = sanitizeSensitiveEventData("USER", {
    id: "user-123",
    nickname: "Test User",
    role: "CUSTOMER",
    status: "ACTIVE",
    updatedAt: "2026-10-10T10:00:00.000Z",
    email: "private@example.com",
    phone: "+2348000000000",
    firstName: "Private",
    lastName: "Person",
    dateOfBirth: "1990-01-01",
    photoUrl: "https://example.test/private.jpg",
    identityNumber: "PRIVATE-ID",
  });

  assert.deepEqual(result, {
    id: "user-123",
    nickname: "Test User",
    role: "CUSTOMER",
    status: "ACTIVE",
    updatedAt: "2026-10-10T10:00:00.000Z",
  });
});

test("unrelated events are unchanged", () => {
  const data = { status: "ASSIGNED" };
  assert.equal(sanitizeSensitiveEventData("BOOKING", data), data);
});

test("malformed sensitive event data becomes null", () => {
  assert.equal(sanitizeSensitiveEventData("DOCUMENT", null), null);
  assert.equal(sanitizeSensitiveEventData("VERIFICATION", []), null);
});
