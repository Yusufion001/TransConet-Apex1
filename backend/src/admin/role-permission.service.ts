import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";
import { AdminStatus } from "../../generated/prisma/enums.js";
import type { AdminModule } from "../../generated/prisma/enums.js";

const adminRoleSelect = {
  userId: true,
  isSuperAdministrator: true,
  administratorType: true,
  assignedModules: true,
  permissions: true,
  status: true,
  createdBy: true,
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
      role: true,
      status: true,
    },
  },
} as const;

async function requireActiveSuperAdministrator(
  administratorId: string,
) {
  const administrator = await prisma.adminProfile.findUnique({
    where: { userId: administratorId },
    select: {
      userId: true,
      isSuperAdministrator: true,
      administratorType: true,
      status: true,
    },
  });

  if (
    !administrator ||
    !administrator.isSuperAdministrator ||
    administrator.administratorType !== "SUPER_ADMIN" ||
    administrator.status !== AdminStatus.ACTIVE
  ) {
    throw new Error(
      "Only an active Super Administrator can modify administrator permissions",
    );
  }

  return administrator;
}

export async function getAdminRoles() {
  return prisma.adminProfile.findMany({
    select: adminRoleSelect,
    orderBy: { createdAt: "desc" },
  });
}

export async function getAdminRole(userId: string) {
  return prisma.adminProfile.findUnique({
    where: { userId },
    select: adminRoleSelect,
  });
}

export async function updateAdminPermissions(
  userId: string,
  administratorId: string,
  assignedModules: AdminModule[],
) {
  await requireActiveSuperAdministrator(administratorId);

  const existing = await prisma.adminProfile.findUnique({
    where: { userId },
  });

  if (!existing) {
    throw new Error("Administrator profile not found");
  }

  if (existing.isSuperAdministrator) {
    throw new Error(
      "Super Administrator permissions cannot be restricted",
    );
  }

  const updated = await prisma.adminProfile.update({
    where: { userId },
    data: {
      assignedModules,
    },
    select: adminRoleSelect,
  });

  publishEvent("admin", {
    eventType: "ADMIN_PERMISSIONS_UPDATED",
    module: "ROLE_PERMISSION",
    entityType: "ADMINISTRATOR",
    entityId: userId,
    actorId: administratorId,
    data: {
      userId,
      assignedModules: updated.assignedModules,
    },
  });

  return updated;
}
