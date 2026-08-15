import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";

export async function getSecurityOverview() {
  const [
    activeAdmins,
    suspendedAdmins,
    lockedAdmins,
    twoFactorAdmins,
    recentAuditLogs,
  ] = await Promise.all([
    prisma.adminProfile.count({
      where: { status: "ACTIVE" },
    }),
    prisma.adminProfile.count({
      where: { status: "SUSPENDED" },
    }),
    prisma.adminProfile.count({
      where: {
        lockedUntil: {
          gt: new Date(),
        },
      },
    }),
    prisma.adminProfile.count({
      where: { twoFactorEnabled: true },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        administrator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        affectedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    }),
  ]);

  return {
    administrators: {
      active: activeAdmins,
      suspended: suspendedAdmins,
      locked: lockedAdmins,
      twoFactorEnabled: twoFactorAdmins,
    },
    recentAuditLogs,
    synchronizedAt: new Date(),
  };
}

export async function getSecurityAuditLogs(options?: {
  administratorId?: string;
  affectedUserId?: string;
  action?: string;
  limit?: number;
}) {
  const limit = Math.min(
    Math.max(options?.limit ?? 100, 1),
    200,
  );

  return prisma.auditLog.findMany({
    where: {
      ...(options?.administratorId
        ? { administratorId: options.administratorId }
        : {}),
      ...(options?.affectedUserId
        ? { affectedUserId: options.affectedUserId }
        : {}),
      ...(options?.action
        ? { action: options.action }
        : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    include: {
      administrator: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      affectedUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
}

export async function getAdministratorSecurity(userId: string) {
  const administrator = await prisma.adminProfile.findUnique({
    where: { userId },
    select: {
      userId: true,
      administratorType: true,
      assignedModules: true,
      permissions: true,
      status: true,
      failedLoginAttempts: true,
      lockedUntil: true,
      twoFactorEnabled: true,
      lastLoginAt: true,
      lastActionAt: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          lastLoginAt: true,
        },
      },
    },
  });

  return administrator;
}

export async function unlockAdministrator(
  userId: string,
  administratorId: string,
) {
  const existing = await prisma.adminProfile.findUnique({
    where: { userId },
  });

  if (!existing) {
    throw new Error("Administrator profile not found");
  }

  const updated = await prisma.adminProfile.update({
    where: { userId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      administratorId,
      affectedUserId: userId,
      action: "ADMINISTRATOR_UNLOCKED",
      previousValue: {
        failedLoginAttempts: existing.failedLoginAttempts,
        lockedUntil: existing.lockedUntil,
      },
      newValue: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    },
  });

  publishEvent("admin", {
    eventType: "ADMINISTRATOR_UNLOCKED",
    module: "SECURITY_CENTER",
    entityType: "ADMINISTRATOR",
    entityId: userId,
    actorId: administratorId,
    data: updated,
  });

  return updated;
}

export async function setAdministratorTwoFactor(
  userId: string,
  enabled: boolean,
  administratorId: string,
) {
  const existing = await prisma.adminProfile.findUnique({
    where: { userId },
  });

  if (!existing) {
    throw new Error("Administrator profile not found");
  }

  const updated = await prisma.adminProfile.update({
    where: { userId },
    data: {
      twoFactorEnabled: enabled,
    },
  });

  await prisma.auditLog.create({
    data: {
      administratorId,
      affectedUserId: userId,
      action: enabled
        ? "ADMINISTRATOR_2FA_ENABLED"
        : "ADMINISTRATOR_2FA_DISABLED",
      previousValue: {
        twoFactorEnabled: existing.twoFactorEnabled,
      },
      newValue: {
        twoFactorEnabled: enabled,
      },
    },
  });

  publishEvent("admin", {
    eventType: enabled
      ? "ADMINISTRATOR_2FA_ENABLED"
      : "ADMINISTRATOR_2FA_DISABLED",
    module: "SECURITY_CENTER",
    entityType: "ADMINISTRATOR",
    entityId: userId,
    actorId: administratorId,
    data: updated,
  });

  return updated;
}
