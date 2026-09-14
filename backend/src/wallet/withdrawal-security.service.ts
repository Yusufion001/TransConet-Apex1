import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { sendWithdrawalSecurityCodeEmail } from "../services/email.service.js";
import { sendSms, verifyPhoneOtp } from "../services/termii.service.js";

type WithdrawalSecurityPurpose =
  | "ADD_WITHDRAWAL_ACCOUNT"
  | "CHANGE_WITHDRAWAL_ACCOUNT";

const MAX_ATTEMPTS = 3;

function purposeFromInput(purpose: WithdrawalSecurityPurpose) {
  return purpose;
}

function hashSecurityCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function codesMatch(storedHash: string, code: string) {
  const actualHash = Buffer.from(hashSecurityCode(code), "hex");
  const expectedHash = Buffer.from(storedHash, "hex");

  return (
    actualHash.length === expectedHash.length &&
    timingSafeEqual(actualHash, expectedHash)
  );
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
      email: true,
      emailVerifiedAt: true,
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

  if (!user.email) {
    throw new Error("An email address is required for withdrawal security");
  }

  if (!user.emailVerifiedAt) {
    throw new Error(
      "Your email address must be verified before managing withdrawal accounts",
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

  const code = randomInt(100000, 1000000).toString();
  const codeHash = hashSecurityCode(code);

  const expiresInMinutes = env.TERMII_OTP_TTL_MINUTES;
  const expiresAt = new Date(
    Date.now() + expiresInMinutes * 60 * 1000,
  );

  const challenge = await prisma.withdrawalSecurityChallenge.create({
    data: {
      userId,
      purpose: purposeFromInput(purpose),
      provider: "DUAL_CHANNEL",
      providerPinId: null,
      codeHash,
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

  const deliveryResults = await Promise.allSettled([
    sendSms(
      user.phone,
      `Your TransConet withdrawal security code is ${code}. It expires in ${expiresInMinutes} minutes. Do not share this code.`,
    ),
    sendWithdrawalSecurityCodeEmail(
      user.email,
      code,
      expiresInMinutes,
    ),
  ]);

  const successfulDeliveries = deliveryResults.filter(
    (result) => result.status === "fulfilled",
  ).length;

  if (successfulDeliveries === 0) {
    await prisma.withdrawalSecurityChallenge.updateMany({
      where: {
        id: challenge.id,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    });

    throw new Error(
      "Unable to deliver withdrawal security code through SMS or email. Please try again.",
    );
  }

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
  if (!/^\d{6}$/.test(pin)) {
    throw new Error("Invalid security verification code");
  }

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
        codeHash: true,
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

  let verified = false;

  if (challenge.codeHash) {
    verified = codesMatch(challenge.codeHash, pin);
  } else if (challenge.providerPinId) {
    try {
      await verifyPhoneOtp(challenge.providerPinId, pin);
      verified = true;
    } catch {
      verified = false;
    }
  }

  if (!verified) {
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
