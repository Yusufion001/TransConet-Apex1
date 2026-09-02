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
  status: "APPROVED" | "REJECTED",
) {
  if (status === "REJECTED") {
    return prisma.transporterProfile.update({
      where: {
        userId: transporterId,
      },
      data: {
        verificationStatus: status,
      },
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: transporterId },
    select: {
      id: true,
      role: true,
      status: true,
      emailVerifiedAt: true,
    },
  });

  if (!user) {
    throw new Error("Transporter not found");
  }

  if (user.role !== "TRANSPORTER") {
    throw new Error("User is not a transporter");
  }

  if (user.status !== "ACTIVE") {
    throw new Error("Transporter account must be active before approval");
  }

  if (!user.emailVerifiedAt) {
    throw new Error("Transporter email must be verified before approval");
  }

  const [profile, identityDocuments, vehicles] = await Promise.all([
    prisma.transporterProfile.findUnique({
      where: { userId: transporterId },
      select: {
        companyName: true,
        address: true,
        city: true,
        state: true,
        country: true,
      },
    }),
    prisma.document.findMany({
      where: {
        userId: transporterId,
        type: "IDENTITY_DOCUMENT",
      },
      select: {
        status: true,
        adminApproved: true,
        verificationProvider: true,
        externalVerificationId: true,
        verifiedAt: true,
      },
    }),
    prisma.vehicle.findMany({
      where: {
        transporterId,
      },
      select: {
        verificationStatus: true,
      },
    }),
  ]);

  if (!profile) {
    throw new Error("Transporter profile must be completed before approval");
  }

  const profileComplete =
    Boolean(profile.companyName) &&
    Boolean(profile.address) &&
    Boolean(profile.city) &&
    Boolean(profile.state) &&
    Boolean(profile.country);

  if (!profileComplete) {
    throw new Error("Transporter profile is incomplete");
  }

  const approvedIdentityDocument = identityDocuments.some(
    (document) =>
      document.status === "APPROVED" &&
      document.adminApproved === true &&
      document.verificationProvider === "YOUVERIFY" &&
      Boolean(document.externalVerificationId) &&
      Boolean(document.verifiedAt),
  );

  if (!approvedIdentityDocument) {
    throw new Error(
      "Transporter requires a Youverify-verified and admin-approved identity document",
    );
  }

  const approvedVehicle = vehicles.some(
    (vehicle) => vehicle.verificationStatus === "APPROVED",
  );

  if (!approvedVehicle) {
    throw new Error("Transporter requires at least one admin-approved vehicle");
  }

  return prisma.transporterProfile.update({
    where: {
      userId: transporterId,
    },
    data: {
      verificationStatus: "APPROVED",
    },
  });
}
