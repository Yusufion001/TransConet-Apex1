import { prisma } from "../config/prisma.js";

export async function getUserById(id: string) {
  return prisma.user.findUnique({select: {
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
  customerProfile: true,
  transporterProfile: true,
},
    where: { id },

  });
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
  return prisma.user.update({select: {
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
  customerProfile: true,
  transporterProfile: true,
},
    where: { id },
    data,

  });
}

