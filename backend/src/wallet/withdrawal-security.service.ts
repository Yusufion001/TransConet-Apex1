import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import {
  sendPhoneOtp,
  verifyPhoneOtp,
} from "../services/termii.service.js";

type WithdrawalSecurityPurpose =
  | "ADD_WITHDRAWAL_ACCOUNT"
  | "CHANGE_WITHDRAWAL_ACCOUNT";

const MAX_ATTEMPTS = 3;

function purposeFromInput(
  purpose: WithdrawalSecurityPurpose,
) {
  return purpose;
}

export async function createWithdrawalSecurityChallenge(
  userId: string,
  purpose: WithdrawalSecurityPurpose,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      status: true,
      role: true,
      phone: true,
      phoneVerifiedAt: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.role !== "TRANSPORTER") {
    throw new Error("Only transporters can manage withdrawal accounts");
  }

  if (user.status !== "ACTIVE") {
    throw new Error("Transporter account is not active");
  }

  if (!user.phone) {
    throw new Error("A phone number is required for withdrawal security");
  }

  if (!user.phoneVerifiedAt) {
    throw new Error(
      "Your phone number must be verified before managing withdrawal accounts",
    );
  }

  const existingChallenge =
    await prisma.withdrawalSecurityChallenge.findFirst({
      where: {
        userId,
        purpose: purposeFromInput(purpose),
        consumedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

  if (
    existingChallenge &&
    Date.now() - existingChallenge.createdAt.getTime() < 60_000
  ) {
    throw new Error(
      "Please wait before requesting another withdrawal security code",
    );
  }

  const otp = await sendPhoneOtp(user.phone);

  const expiresAt = new Date(
    Date.now() + env.TERMII_OTP_TTL_MINUTES * 60 * 1000,
  );

  const challenge =
    await prisma.withdrawalSecurityChallenge.create({
      data: {
        userId,
        purpose: purposeFromInput(purpose),
        provider: "TERMII",
        providerPinId: otp.pinId,
        expiresAt,
        attempts: 0,
        maxAttempts: MAX_ATTEMPTS,
      },
      select: {
        id: true,
        purpose: true,
        expiresAt: true,
      },
    });

  return {
    challengeId: challenge.id,
    purpose: challenge.purpose,
    expiresAt: challenge.expiresAt.toISOString(),
  };
}

export async function verifyWithdrawalSecurityChallenge(
  userId: string,
  challengeId: string,
  pin: string,
) {
  const challenge =
    await prisma.withdrawalSecurityChallenge.findUnique({
      where: {
        id: challengeId,
      },
      select: {
        id: true,
        userId: true,
        purpose: true,
        providerPinId: true,
        expiresAt: true,
        attempts: true,
        maxAttempts: true,
        consumedAt: true,
      },
    });

  if (!challenge || challenge.userId !== userId) {
    throw new Error("Invalid security challenge");
  }

  if (challenge.consumedAt) {
    throw new Error("Security challenge has already been used");
  }

  if (challenge.expiresAt.getTime() <= Date.now()) {
    throw new Error("Security challenge has expired");
  }

  if (challenge.attempts >= challenge.maxAttempts) {
    throw new Error("Maximum security verification attempts exceeded");
  }

  await prisma.withdrawalSecurityChallenge.update({
    where: {
      id: challenge.id,
    },
    data: {
      attempts: {
        increment: 1,
      },
    },
  });

  try {
    await verifyPhoneOtp(
      challenge.providerPinId,
      pin,
    );
  } catch {
    throw new Error("Invalid security verification code");
  }

  const consumed =
    await prisma.withdrawalSecurityChallenge.updateMany({
      where: {
        id: challenge.id,
        userId,
        consumedAt: null,
        attempts: {
          lte: challenge.maxAttempts,
        },
      },
      data: {
        consumedAt: new Date(),
      },
    });

  if (consumed.count !== 1) {
    throw new Error("Security challenge is no longer valid");
  }

  return {
    verified: true,
    challengeId: challenge.id,
    purpose: challenge.purpose,
  };
}
