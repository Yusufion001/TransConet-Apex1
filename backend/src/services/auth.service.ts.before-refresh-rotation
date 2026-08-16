import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import crypto from "crypto";

type UserRole = "CUSTOMER" | "TRANSPORTER" | "ADMIN";

function createAccessToken(userId: string, role: UserRole) {
  return jwt.sign(
    { sub: userId, role, type: "access" },
    env.JWT_ACCESS_SECRET,
    { expiresIn: "15m" },
  );
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createRefreshToken(userId: string) {
  return jwt.sign(
    { sub: userId, type: "refresh" },
    env.JWT_REFRESH_SECRET,
    { expiresIn: "30d" },
  );
}

async function issueTokens(userId: string, role: UserRole) {
  const accessToken = createAccessToken(userId, role);
  const refreshToken = createRefreshToken(userId);
  await prisma.user.update({
    where: { id: userId },
    data: {
      refreshTokenHash: hashToken(refreshToken),
      refreshTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  });
  return { accessToken, refreshToken };
}

export async function registerUser(input: {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  password: string;
  role: UserRole;
}) {
  const passwordHash = await bcrypt.hash(input.password, 12);

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        ...(input.email ? [{ email: input.email }] : []),
        ...(input.phone ? [{ phone: input.phone }] : []),
      ],
    },
  });

  if (existing) {
    throw new Error("An account with this email or phone already exists");
  }

  const user = await prisma.user.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: input.role,
      ...(input.role === "CUSTOMER"
        ? { customerProfile: { create: {} } }
        : {}),
      ...(input.role === "TRANSPORTER"
        ? { transporterProfile: { create: {} } }
        : {}),
    },
    include: {
      customerProfile: true,
      transporterProfile: true,
    },
  });

  return {
    user,
    ...await issueTokens(user.id, user.role),
  };
}

export async function loginUser(identifier: string, password: string) {
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
    },
  });

  if (!user) {
    throw new Error("Invalid credentials");
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);

  if (!validPassword) {
    throw new Error("Invalid credentials");
  }

  if (user.status === "BLOCKED" || user.status === "SUSPENDED") {
    throw new Error("This account is not active");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    user,
    ...await issueTokens(user.id, user.role),
  };
}
export async function forgotPassword(
  identifier: string,
) {
  const user = await prisma.user.findFirst({
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

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");

  const expiresAt = new Date(
    Date.now() + 1000 * 60 * 30,
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

  return {
    resetToken,
    expiresAt,
  };
}

export async function resetPassword(
  token: string,
  password: string,
) {
  const user = await prisma.user.findFirst({
    where: {
      resetPasswordToken: crypto.createHash("sha256").update(token).digest("hex"),
    },
  });

  if (!user) {
    throw new Error("Invalid reset token");
  }

  if (
    !user.resetPasswordExpiresAt ||
    user.resetPasswordExpiresAt <
      new Date()
  ) {
    throw new Error("Reset token expired");
  }

  const passwordHash = await bcrypt.hash(
    password,
    12,
  );

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      passwordHash,
      resetPasswordToken: null,
      resetPasswordExpiresAt: null,
    },
  });

  return {
    message: "Password updated successfully",
  };
}


export async function refreshAccessToken(refreshToken: string) {
  let payload: { sub: string; type: string };

  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as {
      sub: string;
      type: string;
    };
  } catch {
    throw new Error("Invalid refresh token");
  }

  if (payload.type !== "refresh" || !payload.sub) {
    throw new Error("Invalid refresh token");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
  });

  if (!user || !user.refreshTokenHash || !user.refreshTokenExpiresAt) {
    throw new Error("Invalid refresh token");
  }

  if (user.refreshTokenExpiresAt <= new Date()) {
    throw new Error("Refresh token expired");
  }

  if (hashToken(refreshToken) !== user.refreshTokenHash) {
    throw new Error("Invalid refresh token");
  }

  if (user.status === "BLOCKED" || user.status === "SUSPENDED") {
    throw new Error("This account is not active");
  }

  return issueTokens(user.id, user.role);
}

export async function logoutUser(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    },
  });

  return { message: "Logged out successfully" };
}
