import { prisma } from "../config/prisma.js";
import { createAdminInvitation } from "./admin-invitation.service.js";
import {
  AdminModule,
  AdminStatus,
  AdminType,
} from "../../generated/prisma/enums.js";

type CreateAdministratorInput = {
  creatorId: string;
  userId: string;
  administratorType: AdminType;
  assignedModules: AdminModule[];
};

type UpdateAdministratorInput = {
  administratorType?: AdminType;
  assignedModules?: AdminModule[];
};

async function getActiveSuperAdministrator(creatorId: string) {
  const administrator =
    await prisma.adminProfile.findUnique({
      where: {
        userId: creatorId,
      },
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
    administrator.administratorType !== AdminType.SUPER_ADMIN ||
    administrator.status !== AdminStatus.ACTIVE
  ) {
    throw new Error(
      "Only an active Super Administrator can perform this action",
    );
  }

  return administrator;
}

export async function createAdministrator(
  input: CreateAdministratorInput,
) {
  await getActiveSuperAdministrator(input.creatorId);

  if (!input.assignedModules.length) {
    throw new Error(
      "At least one administrator module is required",
    );
  }

  const user =
    await prisma.user.findUnique({
      where: {
        id: input.userId,
      },
    });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.role !== "ADMIN") {
    throw new Error(
      "The user role must be ADMIN",
    );
  }

  const existingAdministrator =
    await prisma.adminProfile.findUnique({
      where: {
        userId: input.userId,
      },
    });

  if (existingAdministrator) {
    throw new Error(
      "Administrator profile already exists",
    );
  }

  if (
    input.administratorType ===
      AdminType.SUPER_ADMIN
  ) {
    const existingSuperAdmin =
      await prisma.adminProfile.findFirst({
        where: {
          isSuperAdministrator: true,
        },
      });

    if (existingSuperAdmin) {
      throw new Error(
        "A Super Administrator already exists",
      );
    }
  }

  const administrator = await prisma.$transaction(async (tx) => {
      const createdAdministrator = await tx.adminProfile.create({
        data: {
          userId: input.userId,
          isSuperAdministrator:
            input.administratorType ===
            AdminType.SUPER_ADMIN,
          administratorType:
            input.administratorType,
          assignedModules:
            input.assignedModules,
          status: AdminStatus.ACTIVE,
          createdBy: input.creatorId,
        },
        include: {
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
        },
      });

    await tx.auditLog.create({
      data: {
        administratorId: input.creatorId,
        action: "ADMINISTRATOR_CREATED",
        affectedUserId: input.userId,
        newValue: {
          administratorType:
            input.administratorType,
          assignedModules:
            input.assignedModules,
          status: AdminStatus.ACTIVE,
        },
      },
    });

    return createdAdministrator;
  });

  await createAdminInvitation(
    input.creatorId,
    input.userId,
  );

  return administrator;
}

export async function listAdministrators(
  creatorId: string,
) {
  await getActiveSuperAdministrator(creatorId);

  return prisma.adminProfile.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
        },
      },
    },
  });
}

export async function getAdministrator(
  creatorId: string,
  userId: string,
) {
  await getActiveSuperAdministrator(creatorId);

  const administrator =
    await prisma.adminProfile.findUnique({
      where: {
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
            status: true,
            createdAt: true,
            lastLoginAt: true,
          },
        },
      },
    });

  if (!administrator) {
    throw new Error(
      "Administrator profile not found",
    );
  }

  return administrator;
}

export async function updateAdministrator(
  creatorId: string,
  userId: string,
  input: UpdateAdministratorInput,
) {
  await getActiveSuperAdministrator(creatorId);

  const existing =
    await prisma.adminProfile.findUnique({
      where: {
        userId,
      },
    });

  if (!existing) {
    throw new Error(
      "Administrator profile not found",
    );
  }

  if (existing.isSuperAdministrator) {
    throw new Error(
      "The Super Administrator profile cannot be modified through this operation",
    );
  }

  if (
    input.administratorType ===
    AdminType.SUPER_ADMIN
  ) {
    throw new Error(
      "SUPER_ADMIN cannot be assigned through an administrator update",
    );
  }

  if (
    input.assignedModules &&
    input.assignedModules.length === 0
  ) {
    throw new Error(
      "At least one administrator module is required",
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated =
      await tx.adminProfile.update({
        where: {
          userId,
        },
        data: {
          ...(input.administratorType !== undefined
            ? {
                administratorType:
                  input.administratorType,
              }
            : {}),
          ...(input.assignedModules !== undefined
            ? {
                assignedModules:
                  input.assignedModules,
              }
            : {}),
        },
        include: {
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
        },
      });

    await tx.auditLog.create({
      data: {
        administratorId: creatorId,
        action: "ADMINISTRATOR_UPDATED",
        affectedUserId: userId,
        previousValue: {
          administratorType:
            existing.administratorType,
          assignedModules:
            existing.assignedModules,
          status: existing.status,
        },
        newValue: {
          administratorType:
            updated.administratorType,
          assignedModules:
            updated.assignedModules,
          status: updated.status,
        },
      },
    });

    return updated;
  });
}

export async function changeAdministratorStatus(
  creatorId: string,
  userId: string,
  status: AdminStatus,
) {
  await getActiveSuperAdministrator(creatorId);

  const existing =
    await prisma.adminProfile.findUnique({
      where: {
        userId,
      },
    });

  if (!existing) {
    throw new Error(
      "Administrator profile not found",
    );
  }

  if (existing.isSuperAdministrator) {
    throw new Error(
      "The Super Administrator cannot be suspended or disabled through this operation",
    );
  }

  if (existing.status === status) {
    throw new Error(
      `Administrator is already ${status}`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated =
      await tx.adminProfile.update({
        where: {
          userId,
        },
        data: {
          status,
        },
      });

    await tx.auditLog.create({
      data: {
        administratorId: creatorId,
        action:
          status === AdminStatus.ACTIVE
            ? "ADMINISTRATOR_ACTIVATED"
            : status === AdminStatus.SUSPENDED
              ? "ADMINISTRATOR_SUSPENDED"
              : "ADMINISTRATOR_DISABLED",
        affectedUserId: userId,
        previousValue: {
          status: existing.status,
        },
        newValue: {
          status: updated.status,
        },
      },
    });

    return updated;
  });
}
