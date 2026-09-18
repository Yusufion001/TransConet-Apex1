import crypto from "node:crypto";
import { generateSecret, generateURI, verify } from "otplib";
import { prisma } from "../config/prisma.js";
import {
  decryptAdminMfaSecret,
  encryptAdminMfaSecret,
} from "./admin-mfa-crypto.js";

const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MFA_MAX_ATTEMPTS = 5;

function normalizeTotpCode(code: string): string {
  const normalized = code.trim();

  if (!/^\d{6}$/.test(normalized)) {
    throw new Error("Invalid MFA code");
  }

  return normalized;
}

function hashChallenge(challenge: string): string {
  return crypto.createHash("sha256").update(challenge).digest("hex");
}

function createChallengeToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function assertAdministrator(userId: string) {
  return prisma.adminProfile.findUnique({
    where: { userId },
    select: {
      userId: true,
      status: true,
      twoFactorEnabled: true,
      user: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
        },
      },
    },
  });
}

export async function getAdministratorMfaStatus(userId: string) {
  const administrator = await assertAdministrator(userId);

  if (
    !administrator ||
    administrator.status !== "ACTIVE" ||
    administrator.user.status !== "ACTIVE" ||
    administrator.user.role !== "ADMIN"
  ) {
    throw new Error("Administrator account is not active");
  }

  const mfa = await prisma.adminMfa.findUnique({
    where: { userId },
    select: {
      enabled: true,
      enrolledAt: true,
      enrollmentExpiresAt: true,
      lastVerifiedAt: true,
    },
  });

  return {
    enabled: mfa?.enabled ?? false,
    enrollmentStarted: Boolean(mfa && !mfa.enabled),
    enrolledAt: mfa?.enrolledAt ?? null,
    enrollmentExpiresAt: mfa?.enrollmentExpiresAt ?? null,
    lastVerifiedAt: mfa?.lastVerifiedAt ?? null,
  };
}

export async function beginAdministratorMfaEnrollment(
  userId: string,
  issuer = "TransConet",
) {
  const administrator = await assertAdministrator(userId);

  if (!administrator) {
    throw new Error("Administrator profile not found");
  }

  if (
    administrator.status !== "ACTIVE" ||
    administrator.user.status !== "ACTIVE" ||
    administrator.user.role !== "ADMIN"
  ) {
    throw new Error("Administrator account is not active");
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + MFA_CHALLENGE_TTL_MS);

  const existing = await prisma.adminMfa.findUnique({
    where: { userId },
  });

  if (existing?.enabled) {
    throw new Error("Administrator MFA is already enabled");
  }

  let secret: string;

  if (
    existing &&
    existing.enrollmentExpiresAt &&
    existing.enrollmentExpiresAt > now
  ) {
    secret = decryptAdminMfaSecret(existing.secretCiphertext);
  } else {
    secret = generateSecret();

    await prisma.adminMfa.upsert({
      where: { userId },
      create: {
        userId,
        secretCiphertext: encryptAdminMfaSecret(secret),
        enabled: false,
        enrolledAt: null,
        enrollmentExpiresAt: expiresAt,
        lastVerifiedAt: null,
      },
      update: {
        secretCiphertext: encryptAdminMfaSecret(secret),
        enabled: false,
        enrolledAt: null,
        enrollmentExpiresAt: expiresAt,
        lastVerifiedAt: null,
      },
    });
  }

  const effectiveExpiresAt =
    existing &&
    existing.enrollmentExpiresAt &&
    existing.enrollmentExpiresAt > now
      ? existing.enrollmentExpiresAt
      : expiresAt;

  const label =
    administrator.user.email ||
    `${administrator.user.firstName} ${administrator.user.lastName}`.trim();

  return {
    userId,
    secret,
    otpauthUri: generateURI({
      issuer,
      label,
      secret,
    }),
    expiresAt: effectiveExpiresAt,
  };
}

export async function completeAdministratorMfaEnrollment(
  userId: string,
  code: string,
) {
  const normalizedCode = normalizeTotpCode(code);

  const mfa = await prisma.adminMfa.findUnique({
    where: { userId },
  });

  if (!mfa) {
    throw new Error("MFA enrollment has not been started");
  }

  if (mfa.enabled) {
    throw new Error("Administrator MFA is already enabled");
  }

  if (
    !mfa.enrollmentExpiresAt ||
    mfa.enrollmentExpiresAt <= new Date()
  ) {
    throw new Error("MFA enrollment has expired");
  }

  const secret = decryptAdminMfaSecret(mfa.secretCiphertext);

  const result = await verify({
    secret,
    token: normalizedCode,
  });

  if (!result.valid) {
    throw new Error("Invalid MFA code");
  }

  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const updatedMfa = await tx.adminMfa.update({
      where: { userId },
      data: {
        enabled: true,
        enrolledAt: now,
        enrollmentExpiresAt: null,
        lastVerifiedAt: now,
      },
    });

    await tx.adminProfile.update({
      where: { userId },
      data: {
        twoFactorEnabled: true,
      },
    });

    return updatedMfa;
  });

  return {
    userId,
    enabled: updated.enabled,
    enrolledAt: updated.enrolledAt,
  };
}

export async function createAdministratorMfaChallenge(
  userId: string,
) {
  const mfa = await prisma.adminMfa.findUnique({
    where: { userId },
    select: {
      enabled: true,
    },
  });

  if (!mfa?.enabled) {
    throw new Error("Administrator MFA is not enabled");
  }

  const challenge = createChallengeToken();
  const expiresAt = new Date(Date.now() + MFA_CHALLENGE_TTL_MS);

  await prisma.adminMfaChallenge.deleteMany({
    where: {
      userId,
      consumedAt: null,
    },
  });

  const created = await prisma.adminMfaChallenge.create({
    data: {
      userId,
      challengeHash: hashChallenge(challenge),
      expiresAt,
      attempts: 0,
      maxAttempts: MFA_MAX_ATTEMPTS,
    },
  });

  return {
    challenge,
    challengeId: created.id,
    expiresAt: created.expiresAt,
  };
}

export async function verifyAdministratorMfaChallenge(
  challenge: string,
  code: string,
) {
  const normalizedCode = normalizeTotpCode(code);
  const challengeHash = hashChallenge(challenge);

  const challengeRecord = await prisma.adminMfaChallenge.findUnique({
    where: { challengeHash },
  });

  if (!challengeRecord) {
    throw new Error("Invalid MFA challenge");
  }

  if (
    challengeRecord.consumedAt ||
    challengeRecord.expiresAt <= new Date() ||
    challengeRecord.attempts >= challengeRecord.maxAttempts
  ) {
    throw new Error("MFA challenge is no longer valid");
  }

  const mfa = await prisma.adminMfa.findUnique({
    where: { userId: challengeRecord.userId },
  });

  if (!mfa?.enabled) {
    throw new Error("Administrator MFA is not enabled");
  }

  const secret = decryptAdminMfaSecret(mfa.secretCiphertext);

  const result = await verify({
    secret,
    token: normalizedCode,
  });

  if (!result.valid) {
    await prisma.adminMfaChallenge.update({
      where: { id: challengeRecord.id },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });

    throw new Error("Invalid MFA code");
  }

  const consumedAt = new Date();

  const consumed = await prisma.adminMfaChallenge.updateMany({
    where: {
      id: challengeRecord.id,
      consumedAt: null,
      expiresAt: {
        gt: consumedAt,
      },
      attempts: {
        lt: challengeRecord.maxAttempts,
      },
    },
    data: {
      consumedAt,
    },
  });

  if (consumed.count !== 1) {
    throw new Error("MFA challenge is no longer valid");
  }

  await prisma.adminMfa.update({
    where: { userId: challengeRecord.userId },
    data: {
      lastVerifiedAt: consumedAt,
    },
  });

  return {
    userId: challengeRecord.userId,
  };
}

export async function disableAdministratorMfa(userId: string) {
  const existing = await prisma.adminMfa.findUnique({
    where: { userId },
  });

  if (!existing) {
    await prisma.adminProfile.update({
      where: { userId },
      data: {
        twoFactorEnabled: false,
      },
    });

    return {
      userId,
      enabled: false,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.adminMfaChallenge.updateMany({
      where: {
        userId,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    });

    await tx.adminMfa.delete({
      where: { userId },
    });

    await tx.adminProfile.update({
      where: { userId },
      data: {
        twoFactorEnabled: false,
      },
    });
  });

  return {
    userId,
    enabled: false,
  };
}
