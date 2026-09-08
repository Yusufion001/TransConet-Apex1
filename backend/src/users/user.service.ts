import { prisma } from "../config/prisma.js";
import { publishAdminEvent } from "../realtime/realtime.service.js";
import { toUserDto } from "./user.dto.js";

const userResponseSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  profilePhoto: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,

  customerProfile: {
    select: {
      userId: true,
      city: true,
      state: true,
      country: true,
      verificationStatus: true,
      rating: true,
      totalBookings: true,
    },
  },

  transporterProfile: {
    select: {
      userId: true,
      companyName: true,
      city: true,
      state: true,
      country: true,
      verificationStatus: true,
      tier2Approved: true,
      rating: true,
      totalTrips: true,
    },
  },

  adminProfile: {
    select: {
      id: true,
      status: true,
      isSuperAdministrator: true,
      administratorType: true,
      assignedModules: true,
    },
  },
};

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: userResponseSelect,
  });

  return user ? toUserDto(user) : null;
}

export async function updateUser(
  id: string,
  data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    profilePhoto?: string;
  },
) {
  if (data.firstName !== undefined || data.lastName !== undefined || data.phone !== undefined) {
    const approvedIdentityVerification = await prisma.verification.findFirst({
      where: {
        userId: id,
        type: {
          in: ["NIN", "DRIVERS_LICENSE"],
        },
        providerStatus: "SUCCESS",
        adminStatus: "APPROVED",
        adminApproved: true,
      },
      select: {
        id: true,
      },
    });

    if (approvedIdentityVerification) {
      throw new Error(
        "Verified personal information cannot be changed after approval. Contact TransConet Admin Management for corrections.",
      );
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: userResponseSelect,
  });

  const userDto = toUserDto(user);

  await publishAdminEvent({
    eventType: "USER_PROFILE_UPDATED",
    module: "ACTIVITY_TIMELINE",
    actorId: id,
    entityType: "USER",
    entityId: id,
    data: userDto,
  });

  return userDto;
}
