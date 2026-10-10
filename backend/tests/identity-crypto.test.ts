import assert from "node:assert/strict";
import test from "node:test";
import {
  decryptIdentityValue,
  encryptIdentityValue,
  isEncryptedIdentityValue,
  maskIdentityValue,
} from "../src/security/identity-crypto.js";

test("identity encryption round-trips without storing plaintext", () => {
  const value = "12345678901";
  const encrypted = encryptIdentityValue(value);

  assert.notEqual(encrypted, value);
  assert.equal(isEncryptedIdentityValue(encrypted), true);
  assert.equal(decryptIdentityValue(encrypted), value);
  assert.equal(encrypted.includes(value), false);
});

test("encrypting the same identity twice uses different ciphertext", () => {
  const first = encryptIdentityValue("12345678901");
  const second = encryptIdentityValue("12345678901");

  assert.notEqual(first, second);
  assert.equal(decryptIdentityValue(first), "12345678901");
  assert.equal(decryptIdentityValue(second), "12345678901");
});

test("tampered ciphertext is rejected", () => {
  const encrypted = encryptIdentityValue("12345678901");
  const parts = encrypted.split(".");
  const ciphertextIndex = 2;
  const ciphertext = parts[ciphertextIndex];
  if (!ciphertext) throw new Error("Test setup failed: ciphertext missing");
  parts[ciphertextIndex] =
    (ciphertext[0] === "A" ? "B" : "A") + ciphertext.slice(1);

  assert.throws(() => decryptIdentityValue(parts.join(".")));
});

test("invalid and already-encrypted input is rejected", () => {
  assert.throws(() => encryptIdentityValue("   "));
  assert.throws(() => encryptIdentityValue("line1\nline2"));
  assert.throws(() => encryptIdentityValue("x".repeat(257)));

  const encrypted = encryptIdentityValue("12345678901");
  assert.throws(() => encryptIdentityValue(encrypted));
  assert.throws(() => decryptIdentityValue("12345678901"));
});

test("identity masking keeps only the last four characters visible", () => {
  assert.equal(maskIdentityValue("12345678901"), "*******8901");
  assert.equal(maskIdentityValue("123"), "***");
});
