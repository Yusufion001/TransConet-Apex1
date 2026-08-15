import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";
import type { AdminModule } from "../../generated/prisma/enums.js";

export async function getAdminRoles() {
  return prisma.adminProfile.findMany({
    select: {
      userId: true,
      administratorType: true,
      status: true,
      isSuperAdministrator: true,
      assignedModules: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAdminRole(userId: string) {
  return prisma.adminProfile.findUnique({
    where: { userId },
    select: {
      userId: true,
      administratorType: true,
      status: true,
      isSuperAdministrator: true,
      assignedModules: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          status: true,
        },
      },
    },
  });
}

export async function updateAdminPermissions(
  userId: string,
  administratorId: string,
  assignedModules: AdminModule[],
) {
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
  });

  publishEvent("admin", {
    eventType: "ADMIN_PERMISSIONS_UPDATED",
    module: "ROLE_PERMISSION",
    entityType: "ADMINISTRATOR",
    entityId: userId,
    actorId: administratorId,
    data: updated,
  });

  return updated;
}
