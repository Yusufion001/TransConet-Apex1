import crypto from "node:crypto";
import { env } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PREFIX = "enc:v1:";

function getEncryptionKey(): Buffer {
  const keyHex = env.IDENTITY_ENCRYPTION_KEY.trim();

  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      "IDENTITY_ENCRYPTION_KEY must be exactly 32 bytes encoded as 64 hexadecimal characters",
    );
  }

  const key = Buffer.from(keyHex, "hex");
  if (key.length !== KEY_LENGTH) {
    throw new Error("Invalid identity encryption key length");
  }

  return key;
}

function normalizeIdentityValue(value: string): string {
  if (typeof value !== "string") {
    throw new Error("Identity value must be a string");
  }

  const normalized = value.trim();

  if (
    normalized.length === 0 ||
    normalized.length > 256 ||
    /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw new Error("Invalid identity value");
  }

  return normalized;
}

export function isEncryptedIdentityValue(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptIdentityValue(value: string): string {
  const normalized = normalizeIdentityValue(value);

  if (isEncryptedIdentityValue(normalized)) {
    throw new Error("Identity value is already encrypted");
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const ciphertext = Buffer.concat([
    cipher.update(normalized, "utf8"),
    cipher.final(),
  ]);

  return PREFIX + [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptIdentityValue(encrypted: string): string {
  if (!isEncryptedIdentityValue(encrypted)) {
    throw new Error("Unsupported encrypted identity value format");
  }

  const parts = encrypted.slice(PREFIX.length).split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted identity value format");
  }

  const [ivEncoded, tagEncoded, ciphertextEncoded] = parts;
  const iv = Buffer.from(ivEncoded, "base64url");
  const tag = Buffer.from(tagEncoded, "base64url");
  const ciphertext = Buffer.from(ciphertextEncoded, "base64url");

  if (
    iv.length !== IV_LENGTH ||
    tag.length !== AUTH_TAG_LENGTH ||
    ciphertext.length === 0
  ) {
    throw new Error("Invalid encrypted identity value");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");

  return normalizeIdentityValue(plaintext);
}

export function maskIdentityValue(value: string): string {
  const normalized = normalizeIdentityValue(value);
  const visible = normalized.length > 4 ? 4 : 0;
  return visible === 0
    ? "*".repeat(normalized.length)
    : "*".repeat(normalized.length - visible) + normalized.slice(-visible);
}
