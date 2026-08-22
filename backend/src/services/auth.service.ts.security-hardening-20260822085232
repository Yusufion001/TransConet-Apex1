import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { sendPasswordResetEmail } from "./email.service.js";

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
  email?: string;
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

  return {
    user,
    ...await issueTokens(
      user.id,
      user.role,
    ),
  };
}

export async function loginUser(
  identifier: string,
  password: string,
) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier },
        { phone: identifier },
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

  if (
    user.status === "BLOCKED" ||
    user.status === "SUSPENDED"
  ) {
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
    user,
    ...await issueTokens(
      user.id,
      user.role,
    ),
  };
}

export async function forgotPassword(
  identifier: string,
) {
  const user =
    await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { phone: identifier },
        ],
      },
    });

  if (!user) {
    return {
      message:
        "If an account exists, a reset token has been generated.",
    };
  }

  const resetToken =
    crypto.randomBytes(32).toString("hex");

  const resetTokenHash =
    hashToken(resetToken);

  const expiresAt =
    new Date(
      Date.now() +
        1000 * 60 * 30,
    );

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      resetPasswordToken:
        resetTokenHash,
      resetPasswordExpiresAt:
        expiresAt,
    },
  });

  if (user.email) {
    try {
      await sendPasswordResetEmail(
        user.email,
        resetToken,
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

  if (!user) {
    throw new Error(
      "Invalid reset token",
    );
  }

  if (
    !user.resetPasswordExpiresAt ||
    user.resetPasswordExpiresAt <=
      new Date()
  ) {
    throw new Error(
      "Reset token expired",
    );
  }

  const passwordHash =
    await bcrypt.hash(
      password,
      12,
    );

  await prisma.$transaction(
    async (tx) => {
      await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          passwordHash,
          resetPasswordToken: null,
          resetPasswordExpiresAt: null,
        },
      });

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
