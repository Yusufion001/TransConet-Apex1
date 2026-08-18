import { prisma } from "../config/prisma.js";
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
  const user = await prisma.user.update({
    where: { id },
    data,
    select: userResponseSelect,
  });

  return toUserDto(user);
}
