import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { sendEmailVerificationEmail, sendPasswordResetEmail } from "./email.service.js";
import { sendPhoneOtp, verifyPhoneOtp } from "./termii.service.js";
import { toUserDto } from "../users/user.dto.js";

type UserRole = "CUSTOMER" | "TRANSPORTER" | "ADMIN";

type RefreshTokenPayload = {
  sub: string;
  type: "refresh";
  jti: string;
  familyId: string;
};

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createPhoneVerificationToken(userId: string) {
  return jwt.sign(
    {
      sub: userId,
      type: "phone_verification",
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: "24h",
    },
  );
}

function verifyPhoneVerificationToken(token: string): string {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);

  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof payload.sub !== "string" ||
    payload.sub.length === 0 ||
    payload.type !== "phone_verification"
  ) {
    throw new Error("Invalid phone verification token");
  }

  return payload.sub;
}

function createAccessToken(userId: string, role: UserRole) {
  return jwt.sign(
    {
      sub: userId,
      role,
      type: "access",
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: "15m",
    },
  );
}

function createRefreshToken(
  userId: string,
  tokenId: string,
  familyId: string,
) {
  return jwt.sign(
    {
      sub: userId,
      type: "refresh",
      jti: tokenId,
      familyId,
    },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: "30d",
    },
  );
}

function verifyRefreshToken(
  token: string,
): RefreshTokenPayload {
  const payload = jwt.verify(
    token,
    env.JWT_REFRESH_SECRET,
  );

  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof payload.sub !== "string" ||
    typeof payload.jti !== "string" ||
    typeof payload.familyId !== "string" ||
    payload.type !== "refresh"
  ) {
    throw new Error("Invalid refresh token");
  }

  return {
    sub: payload.sub,
    jti: payload.jti,
    familyId: payload.familyId,
    type: "refresh",
  };
}

async function createRefreshSession(
  userId: string,
  familyId = crypto.randomUUID(),
) {
  const tokenId = crypto.randomUUID();

  const refreshToken = createRefreshToken(
    userId,
    tokenId,
    familyId,
  );

  const expiresAt = new Date(
    Date.now() +
      1000 * 60 * 60 * 24 * 30,
  );

  await prisma.refreshSession.create({
    data: {
      userId,
      familyId,
      tokenId,
      tokenHash: hashToken(refreshToken),
      expiresAt,
    },
  });

  return {
    refreshToken,
    tokenId,
    familyId,
    expiresAt,
  };
}

async function issueTokens(
  userId: string,
  role: UserRole,
) {
  const accessToken = createAccessToken(
    userId,
    role,
  );

  const session =
    await createRefreshSession(userId);

  return {
    accessToken,
    refreshToken: session.refreshToken,
  };
}

export async function registerUser(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  role: UserRole;
}) {
  const passwordHash =
    await bcrypt.hash(input.password, 12);

  const existing =
    await prisma.user.findFirst({
      where: {
        OR: [
          ...(input.email
            ? [{ email: input.email }]
            : []),
          ...(input.phone
            ? [{ phone: input.phone }]
            : []),
        ],
      },
    });

  if (existing) {
    throw new Error(
      "An account with this email or phone already exists",
    );
  }

  const user =
    await prisma.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        passwordHash,
        role: input.role,
        ...(input.role === "CUSTOMER"
          ? {
              customerProfile: {
                create: {},
              },
            }
          : {}),
        ...(input.role === "TRANSPORTER"
          ? {
              transporterProfile: {
                create: {},
              },
            }
          : {}),
      },
      include: {
        customerProfile: true,
        transporterProfile: true,
      },
    });

  if (user.phone) {
    try {
      await sendPhoneVerificationOtp(user.id);
    } catch {
      // Registration remains successful.
      // The user can request another phone verification OTP.
    }
  }

  if (user.email) {
    const verificationToken =
      crypto.randomBytes(32).toString("hex");

    const verificationTokenHash =
      hashToken(verificationToken);

    const verificationExpiresAt =
      new Date(Date.now() + 30 * 60 * 1000);

    await prisma.emailVerification.upsert({
      where: {
        userId: user.id,
      },
      update: {
        tokenHash: verificationTokenHash,
        expiresAt: verificationExpiresAt,
        consumedAt: null,
        attempts: 0,
      },
      create: {
        userId: user.id,
        tokenHash: verificationTokenHash,
        expiresAt: verificationExpiresAt,
      },
    });

    try {
      await sendEmailVerificationEmail(
        user.email,
        verificationToken,
      );
    } catch {
      // Registration remains successful.
      // The user can request another verification email.
    }
  }

  return {
    user: toUserDto(user),
    requiresEmailVerification: Boolean(user.email),
    requiresPhoneVerification: Boolean(user.phone),
    phoneVerificationToken: user.phone
      ? createPhoneVerificationToken(user.id)
      : undefined,
    authenticated: false,
  };
}

export async function loginUser(
  identifier: string,
  password: string,
) {
  const normalizedIdentifier = identifier.trim();
  const emailIdentifier = normalizedIdentifier.toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: emailIdentifier },
        { phone: normalizedIdentifier },
      ],
    },
    include: {
      customerProfile: true,
      transporterProfile: true,
      adminProfile: true,
    },
  });

  if (!user) {
    throw new Error("Invalid credentials");
  }

  /*
   * Only ACTIVE accounts may authenticate.
   *
   * PENDING accounts must complete the required
   * verification/activation flow before login.
   * BLOCKED and SUSPENDED accounts are also denied.
   */
  if (user.status !== "ACTIVE") {
    throw new Error("This account is not active");
  }

  /*
   * Administrator security is controlled by AdminProfile
   * in addition to the normal User status.
   */
  if (user.role === "ADMIN") {
    const administrator = user.adminProfile;

    if (!administrator) {
      throw new Error("Administrator profile not found");
    }

    if (administrator.status !== "ACTIVE") {
      throw new Error("Administrator account is not active");
    }

    if (
      administrator.lockedUntil &&
      administrator.lockedUntil > new Date()
    ) {
      throw new Error("Administrator account is temporarily locked");
    }
  }

  const validPassword = await bcrypt.compare(
    password,
    user.passwordHash,
  );

  if (!validPassword) {
    /*
     * Failed administrator authentication is tracked separately
     * from normal customer/transporter authentication.
     *
     * Five consecutive failures produce a 15-minute lock.
     */
    if (user.role === "ADMIN" && user.adminProfile) {
      const administrator = user.adminProfile;
      const failedAttempts = administrator.failedLoginAttempts + 1;
      const shouldLock = failedAttempts >= 5;

      await prisma.adminProfile.update({
        where: {
          userId: user.id,
        },
        data: {
          failedLoginAttempts: shouldLock ? 0 : failedAttempts,
          lockedUntil: shouldLock
            ? new Date(Date.now() + 15 * 60 * 1000)
            : null,
        },
      });
    }

    throw new Error("Invalid credentials");
  }

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      lastLoginAt: new Date(),
    },
  });

  if (user.role === "ADMIN" && user.adminProfile) {
    await prisma.adminProfile.update({
      where: {
        userId: user.id,
      },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastActionAt: new Date(),
      },
    });
  }

  return {
    user: toUserDto(user),
    ...await issueTokens(
      user.id,
      user.role,
    ),
  };
}


export async function sendPhoneVerificationOtp(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      phoneVerifiedAt: true,
      phoneVerificationLastSentAt: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (!user.phone) {
    throw new Error("A phone number is required for phone verification");
  }

  if (user.phoneVerifiedAt) {
    return {
      message: "Phone number is already verified",
      verified: true,
      phoneVerificationToken: createPhoneVerificationToken(user.id),
    };
  }

  if (
    user.phoneVerificationLastSentAt &&
    Date.now() - user.phoneVerificationLastSentAt.getTime() < 60 * 1000
  ) {
    throw new Error("Please wait before requesting another verification code");
  }

  const otp = await sendPhoneOtp(user.phone);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      phoneVerificationPinId: otp.pinId,
      phoneVerificationExpiresAt: new Date(
        Date.now() + env.TERMII_OTP_TTL_MINUTES * 60 * 1000,
      ),
      phoneVerificationAttempts: 0,
      phoneVerificationLastSentAt: new Date(),
    },
  });

  return {
    message: "Verification code sent successfully",
    verified: false,
    phoneVerificationToken: createPhoneVerificationToken(user.id),
  };
}

export async function resendPhoneVerificationOtp(
  phoneVerificationToken: string,
) {
  const userId = verifyPhoneVerificationToken(phoneVerificationToken);

  return sendPhoneVerificationOtp(userId);
}

export async function verifyPhoneVerificationOtp(
  phoneVerificationToken: string,
  pin: string,
) {
  const userId = verifyPhoneVerificationToken(phoneVerificationToken);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      phone: true,
      phoneVerifiedAt: true,
      phoneVerificationPinId: true,
      phoneVerificationExpiresAt: true,
      phoneVerificationAttempts: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.phoneVerifiedAt) {
    return {
      message: "Phone number is already verified",
      verified: true,
    };
  }

  if (!user.phone || !user.phoneVerificationPinId) {
    throw new Error("No active phone verification request");
  }

  if (
    !user.phoneVerificationExpiresAt ||
    user.phoneVerificationExpiresAt <= new Date()
  ) {
    throw new Error("Verification code has expired");
  }

  if (user.phoneVerificationAttempts >= 3) {
    throw new Error("Too many verification attempts");
  }

  /*
   * Verify with Termii before consuming a local attempt.
   * A provider/network failure therefore does not consume
   * one of the user's three verification attempts.
   */
  await verifyPhoneOtp(
    user.phoneVerificationPinId,
    pin,
  );

  const now = new Date();

  /*
   * Activate the account atomically after successful OTP
   * verification.
   *
   * Phone verification is sufficient for activation.
   * Email verification is not required when the phone OTP
   * has been successfully verified.
   */
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: {
        id: user.id,
        phoneVerifiedAt: null,
        phoneVerificationPinId: user.phoneVerificationPinId,
        phoneVerificationExpiresAt: {
          gt: now,
        },
        phoneVerificationAttempts: {
          lt: 3,
        },
      },
      data: {
        phoneVerifiedAt: now,
        phoneVerificationPinId: null,
        phoneVerificationExpiresAt: null,
        phoneVerificationAttempts: 0,
        status: "ACTIVE",
      },
    });

    if (updated.count !== 1) {
      throw new Error(
        "Phone verification request is no longer valid",
      );
    }

    await tx.refreshSession.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    return tx.user.findUnique({
      where: {
        id: user.id,
      },
      include: {
        customerProfile: true,
        transporterProfile: true,
        adminProfile: true,
      },
    });
  });

  if (!result) {
    throw new Error("User not found");
  }

  return {
    message: "Phone number verified successfully",
    verified: true,
    user: toUserDto(result),
    ...await issueTokens(
      result.id,
      result.role,
    ),
  };
}

export async function verifyEmail(token: string) {
  const tokenHash = hashToken(token);

  const result = await prisma.$transaction(async (tx) => {
    const verification =
      await tx.emailVerification.findUnique({
        where: {
          tokenHash,
        },
        include: {
          user: true,
        },
      });

    if (
      !verification ||
      verification.consumedAt ||
      verification.expiresAt <= new Date()
    ) {
      throw new Error(
        "Invalid or expired verification token",
      );
    }

    const now = new Date();

    /*
     * Consume the verification token atomically.
     * Only one concurrent request can activate this token.
     */
    const consumed =
      await tx.emailVerification.updateMany({
        where: {
          id: verification.id,
          tokenHash,
          consumedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          consumedAt: now,
        },
      });

    if (consumed.count !== 1) {
      throw new Error(
        "Invalid or expired verification token",
      );
    }

    /*
     * Either email verification or phone verification is
     * sufficient to activate the account.
     *
     * Email is required during registration, but a supplied
     * phone number does not make email verification mandatory.
     */
    const user = await tx.user.update({
      where: {
        id: verification.userId,
      },
      data: {
        emailVerifiedAt: now,
        status: "ACTIVE",
      },
      include: {
        customerProfile: true,
        transporterProfile: true,
        adminProfile: true,
      },
    });

    /*
     * A PENDING registration must never retain an old session.
     * Revoke any existing refresh sessions before issuing the
     * first authenticated session.
     */
    await tx.refreshSession.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    return user;
  });

  /*
   * Issue the first authenticated session only after the
   * activation transaction has committed successfully.
   */
  return {
    user: toUserDto(result),
    ...await issueTokens(
      result.id,
      result.role,
    ),
  };
}

export async function resendEmailVerification(identifier: string) {
  const user =
    await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { phone: identifier },
        ],
      },
    });

  /*
   * Keep this response generic so the endpoint cannot
   * be used to enumerate registered accounts.
   */
  if (!user || !user.email || user.emailVerifiedAt) {
    return {
      message:
        "If an eligible account exists, a verification email has been sent.",
    };
  }

  const verificationToken =
    crypto.randomBytes(32).toString("hex");

  const verificationTokenHash =
    hashToken(verificationToken);

  const expiresAt =
    new Date(Date.now() + 30 * 60 * 1000);

  await prisma.emailVerification.upsert({
    where: {
      userId: user.id,
    },
    update: {
      tokenHash: verificationTokenHash,
      expiresAt,
      consumedAt: null,
      attempts: {
        increment: 1,
      },
    },
    create: {
      userId: user.id,
      tokenHash: verificationTokenHash,
      expiresAt,
      attempts: 1,
    },
  });

  try {
    await sendEmailVerificationEmail(
      user.email,
      verificationToken,
    );
  } catch {
    // Do not expose email delivery failures.
  }

  return {
    message:
      "If an eligible account exists, a verification email has been sent.",
  };
}

export async function forgotPassword(
  identifier: string,
) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier.trim().toLowerCase() },
        { phone: identifier.trim() },
      ],
    },
  });

  if (!user) {
    return {
      message:
        "If an account exists, a password reset email has been sent.",
    };
  }

  const resetToken = String(
    crypto.randomInt(100000, 1000000),
  );

  const resetTokenHash = hashToken(resetToken);

  const expiresAt = new Date(
    Date.now() + 1000 * 60,
  );

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      resetPasswordToken: resetTokenHash,
      resetPasswordExpiresAt: expiresAt,
    },
  });

  if (user.email) {
    try {
      let superAdministratorEmail: string | undefined;

      if (user.role === "ADMIN") {
        const superAdministrator =
          await prisma.adminProfile.findFirst({
            where: {
              isSuperAdministrator: true,
              status: "ACTIVE",
              administratorType: "SUPER_ADMIN",
            },
            select: {
              user: {
                select: {
                  email: true,
                },
              },
            },
          });

        superAdministratorEmail =
          superAdministrator?.user.email ?? undefined;

        if (
          superAdministratorEmail &&
          superAdministratorEmail.toLowerCase() ===
            user.email.toLowerCase()
        ) {
          superAdministratorEmail = undefined;
        }
      }

      await sendPasswordResetEmail(
        user.email,
        resetToken,
        superAdministratorEmail,
      );
    } catch {
      // Do not expose email-delivery failures to the client.
      // The reset token remains stored hashed in the database.
    }
  }

  return {
    message:
      "If an account exists, a password reset email has been sent.",
  };
}

export async function resetPassword(
  token: string,
  password: string,
) {
  const tokenHash =
    hashToken(token);

  const user =
    await prisma.user.findFirst({
      where: {
        resetPasswordToken:
          tokenHash,
      },
    });

  /*
   * Do not reveal whether a reset token is invalid or expired.
   * The external API should expose one generic failure state.
   */
  if (
    !user ||
    !user.resetPasswordExpiresAt ||
    user.resetPasswordExpiresAt <=
      new Date()
  ) {
    throw new Error(
      "Invalid or expired reset token",
    );
  }

  const passwordHash =
    await bcrypt.hash(
      password,
      12,
    );

  await prisma.$transaction(
    async (tx) => {
      /*
       * Consume the reset token atomically.
       *
       * The token hash and expiration are part of the
       * update predicate. Only one concurrent request can
       * successfully consume a given reset token.
       */
      const consumed =
        await tx.user.updateMany({
          where: {
            id: user.id,
            resetPasswordToken: tokenHash,
            resetPasswordExpiresAt: {
              gt: new Date(),
            },
          },
          data: {
            passwordHash,
            resetPasswordToken: null,
            resetPasswordExpiresAt: null,
          },
        });

      if (consumed.count !== 1) {
        throw new Error(
          "Invalid or expired reset token",
        );
      }

      /*
       * Password reset invalidates every active
       * refresh-token family for this user.
       */
      await tx.refreshSession.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    },
  );

  return {
    message:
      "Password updated successfully",
  };
}

async function revokeRefreshFamily(
  familyId: string,
  reuseDetected = false,
) {
  await prisma.refreshSession.updateMany({
    where: {
      familyId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      ...(reuseDetected
        ? {
            reuseDetectedAt:
              new Date(),
          }
        : {}),
    },
  });
}

export async function refreshAccessToken(
  refreshToken: string,
) {
  let payload: RefreshTokenPayload;

  try {
    payload =
      verifyRefreshToken(
        refreshToken,
      );
  } catch {
    throw new Error(
      "Invalid refresh token",
    );
  }

  const session =
    await prisma.refreshSession.findUnique({
      where: {
        tokenId: payload.jti,
      },
    });

  if (!session) {
    throw new Error(
      "Invalid refresh token",
    );
  }

  /*
   * If this token was already rotated or revoked,
   * using it again is a refresh-token reuse event.
   *
   * Revoke the entire token family immediately.
   */
  if (
    session.revokedAt ||
    session.replacedByTokenId
  ) {
    await revokeRefreshFamily(
      session.familyId,
      true,
    );

    throw new Error(
      "Refresh token reuse detected",
    );
  }

  if (
    session.familyId !==
    payload.familyId ||
    session.userId !==
    payload.sub
  ) {
    throw new Error(
      "Invalid refresh token",
    );
  }

  if (
    session.expiresAt <=
    new Date()
  ) {
    await revokeRefreshFamily(
      session.familyId,
    );

    throw new Error(
      "Refresh token expired",
    );
  }

  if (
    hashToken(refreshToken) !==
    session.tokenHash
  ) {
    await revokeRefreshFamily(
      session.familyId,
      true,
    );

    throw new Error(
      "Refresh token reuse detected",
    );
  }

  const user =
    await prisma.user.findUnique({
      where: {
        id: session.userId,
      },
      select: {
        id: true,
        role: true,
        status: true,
        adminProfile: {
          select: {
            status: true,
          },
        },
      },
    });

  if (!user) {
    await revokeRefreshFamily(
      session.familyId,
    );

    throw new Error(
      "Invalid refresh token",
    );
  }

  if (
    user.status === "BLOCKED" ||
    user.status === "SUSPENDED"
  ) {
    await revokeRefreshFamily(
      session.familyId,
    );

    throw new Error(
      "This account is not active",
    );
  }

  /*
   * Administrator status is authoritative in AdminProfile.
   * A suspended or disabled administrator must not be able
   * to obtain a new access token from an existing refresh token.
   */
  if (
    user.role === "ADMIN" &&
    (!user.adminProfile || user.adminProfile.status !== "ACTIVE")
  ) {
    await revokeRefreshFamily(
      session.familyId,
    );

    throw new Error(
      "Administrator account is not active",
    );
  }

  /*
   * Create the replacement token first.
   * The database transaction ensures the old token
   * cannot remain valid after successful rotation.
   */
  const newTokenId =
    crypto.randomUUID();

  const newRefreshToken =
    createRefreshToken(
      user.id,
      newTokenId,
      session.familyId,
    );

  const newExpiresAt =
    new Date(
      Date.now() +
        1000 * 60 * 60 * 24 * 30,
    );

  const accessToken =
    createAccessToken(
      user.id,
      user.role,
    );

  try {
    await prisma.$transaction(
      async (tx) => {
        const consumed =
          await tx.refreshSession.updateMany({
            where: {
              id: session.id,
              revokedAt: null,
              replacedByTokenId: null,
            },
            data: {
              revokedAt:
                new Date(),
              lastUsedAt:
                new Date(),
              replacedByTokenId:
                newTokenId,
            },
          });

        if (consumed.count !== 1) {
          throw new Error(
            "Refresh token reuse detected",
          );
        }

        await tx.refreshSession.create({
          data: {
            userId: user.id,
            familyId:
              session.familyId,
            tokenId:
              newTokenId,
            tokenHash:
              hashToken(
                newRefreshToken,
              ),
            expiresAt:
              newExpiresAt,
            replacedTokenId:
              session.tokenId,
          },
        });
      },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "Refresh token reuse detected"
    ) {
      await revokeRefreshFamily(
        session.familyId,
        true,
      );
    }

    throw error;
  }

  return {
    accessToken,
    refreshToken:
      newRefreshToken,
  };
}

export async function logoutUser(
  userId: string,
) {
  await prisma.$transaction(
    async (tx) => {
      await tx.refreshSession.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    },
  );

  return {
    message:
      "Logged out successfully",
  };
}
