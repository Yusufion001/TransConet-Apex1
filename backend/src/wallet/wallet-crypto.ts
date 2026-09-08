import crypto from "node:crypto";
import { env } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const keyHex = env.WALLET_ENCRYPTION_KEY.trim();

  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      "WALLET_ENCRYPTION_KEY must be exactly 32 bytes encoded as 64 hexadecimal characters",
    );
  }

  const key = Buffer.from(keyHex, "hex");

  if (key.length !== KEY_LENGTH) {
    throw new Error("Invalid wallet encryption key length");
  }

  return key;
}

function normalizeAccountNumber(accountNumber: string): string {
  const normalized = accountNumber.trim();

  if (!/^\d{10}$/.test(normalized)) {
    throw new Error("Account number must be exactly 10 digits");
  }

  return normalized;
}

export function encryptAccountNumber(accountNumber: string): string {
  const normalized = normalizeAccountNumber(accountNumber);
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const ciphertext = Buffer.concat([
    cipher.update(normalized, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptAccountNumber(encrypted: string): string {
  const parts = encrypted.split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted account number format");
  }

  const [ivEncoded, authTagEncoded, ciphertextEncoded] = parts;

  const iv = Buffer.from(ivEncoded, "base64url");
  const authTag = Buffer.from(authTagEncoded, "base64url");
  const ciphertext = Buffer.from(ciphertextEncoded, "base64url");

  if (
    iv.length !== IV_LENGTH ||
    authTag.length !== AUTH_TAG_LENGTH ||
    ciphertext.length === 0
  ) {
    throw new Error("Invalid encrypted account number");
  }

  const key = getEncryptionKey();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");

  return normalizeAccountNumber(plaintext);
}

export function fingerprintAccountNumber(accountNumber: string): string {
  const normalized = normalizeAccountNumber(accountNumber);

  return crypto
    .createHmac("sha256", getEncryptionKey())
    .update(`transconet:withdrawal-account:${normalized}`, "utf8")
    .digest("hex");
}

export function accountNumberLast4(accountNumber: string): string {
  const normalized = normalizeAccountNumber(accountNumber);
  return normalized.slice(-4);
}
