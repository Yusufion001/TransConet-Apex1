import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

type UserRole = "CUSTOMER" | "TRANSPORTER" | "ADMIN";

function createAccessToken(userId: string, role: UserRole) {
  return jwt.sign(
    { sub: userId, role, type: "access" },
    env.JWT_ACCESS_SECRET,
    { expiresIn: "15m" },
  );
}

function createRefreshToken(userId: string) {
  return jwt.sign(
    { sub: userId, type: "refresh" },
    env.JWT_REFRESH_SECRET,
    { expiresIn: "30d" },
  );
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
    accessToken: createAccessToken(user.id, user.role),
    refreshToken: createRefreshToken(user.id),
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
    accessToken: createAccessToken(user.id, user.role),
    refreshToken: createRefreshToken(user.id),
  };
}
