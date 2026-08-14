import { prisma } from "../config/prisma.js";

export async function getTransporterVehicles(
  transporterId: string,
) {
  return prisma.vehicle.findMany({
    where: {
      transporterId,
    },
  });
}
export async function getTransporterProfile(
  transporterId: string,
) {
  return prisma.transporterProfile.findUnique({
    where: {
      userId: transporterId,
    },
  });
}
export async function createTransporterProfile(data: {
  userId: string;
  companyName?: string;
  businessRegistrationNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}) {
  return prisma.transporterProfile.create({
    data,
  });
}
export async function updateTransporterVerification(
  transporterId: string,
  status:
    | "APPROVED"
    | "REJECTED",
) {
  return prisma.transporterProfile.update({
    where: {
      userId: transporterId,
    },
    data: {
      verificationStatus: status,
    },
  });
}
