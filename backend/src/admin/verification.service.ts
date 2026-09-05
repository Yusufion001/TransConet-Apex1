import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";

const TRANSPORTER_VERIFICATION_TYPES = [
  "NIN",
  "DRIVERS_LICENSE",
  "BUSINESS_REGISTRATION",
] as const;

type TransporterVerificationType =
  (typeof TRANSPORTER_VERIFICATION_TYPES)[number];

function isTransporterVerificationType(
  value: string,
): value is TransporterVerificationType {
  return (TRANSPORTER_VERIFICATION_TYPES as readonly string[]).includes(value);
}

export async function getPendingTransporterVerifications() {
  return prisma.verification.findMany({
    where: {
      adminStatus: "PENDING",
      type: {
        in: [...TRANSPORTER_VERIFICATION_TYPES],
      },
      user: {
        role: "TRANSPORTER",
      },
    },
    orderBy: {
      createdAt: "asc",
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
          transporterProfile: {
            select: {
              transporterType: true,
              companyName: true,
              businessRegistrationNumber: true,
            },
          },
        },
      },
    },
  });
}

export async function getApprovedTransporterVerifications() {
  return prisma.verification.findMany({
    where: {
      adminStatus: "APPROVED",
      type: {
        in: [...TRANSPORTER_VERIFICATION_TYPES],
      },
      user: {
        role: "TRANSPORTER",
      },
    },
    orderBy: {
      adminApprovedAt: "desc",
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
          transporterProfile: {
            select: {
              transporterType: true,
              companyName: true,
              businessRegistrationNumber: true,
            },
          },
        },
      },
    },
  });
}

export async function approveTransporterVerification(
  verificationId: string,
  reviewedBy: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const verification = await tx.verification.findUnique({
      where: {
        id: verificationId,
      },
      include: {
        user: {
          select: {
            id: true,
            role: true,
            transporterProfile: {
              select: {
                transporterType: true,
              },
            },
          },
        },
      },
    });

    if (!verification) {
      throw new Error("Verification not found");
    }

    if (!isTransporterVerificationType(verification.type)) {
      throw new Error("This verification type is not supported for transporter approval");
    }

    if (verification.user.role !== "TRANSPORTER") {
      throw new Error("Verification does not belong to a transporter");
    }

    if (!verification.user.transporterProfile) {
      throw new Error("Transporter profile not found");
    }

    if (verification.adminStatus === "APPROVED") {
      throw new Error("Verification is already approved");
    }

    if (verification.providerStatus !== "SUCCESS") {
      throw new Error(
        "This verification must have a successful Youverify result before admin approval",
      );
    }

    if (
      verification.type === "BUSINESS_REGISTRATION" &&
      verification.user.transporterProfile.transporterType !== "BUSINESS"
    ) {
      throw new Error(
        "Business registration verification is only available to BUSINESS transporters",
      );
    }

    const updated = await tx.verification.update({
      where: {
        id: verificationId,
      },
      data: {
        adminStatus: "APPROVED",
        adminApproved: true,
        adminApprovedAt: new Date(),
        reviewedBy,
        rejectionReason: null,
      },
    });

    return updated;
  });

  publishEvent("admin", {
    eventType: "VERIFICATION_ADMIN_APPROVED",
    module: "VERIFICATION_CENTER",
    entityType: "VERIFICATION",
    entityId: result.id,
    actorId: reviewedBy,
    data: result,
  });

  return result;
}

export async function rejectTransporterVerification(
  verificationId: string,
  reviewedBy: string,
  rejectionReason: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const verification = await tx.verification.findUnique({
      where: {
        id: verificationId,
      },
      include: {
        user: {
          select: {
            id: true,
            role: true,
          },
        },
      },
    });

    if (!verification) {
      throw new Error("Verification not found");
    }

    if (!isTransporterVerificationType(verification.type)) {
      throw new Error("This verification type is not supported for transporter approval");
    }

    if (verification.user.role !== "TRANSPORTER") {
      throw new Error("Verification does not belong to a transporter");
    }

    if (verification.adminStatus === "REJECTED") {
      throw new Error("Verification is already rejected");
    }

    const updated = await tx.verification.update({
      where: {
        id: verificationId,
      },
      data: {
        adminStatus: "REJECTED",
        adminApproved: false,
        adminApprovedAt: null,
        reviewedBy,
        rejectionReason,
      },
    });

    return updated;
  });

  publishEvent("admin", {
    eventType: "VERIFICATION_ADMIN_REJECTED",
    module: "VERIFICATION_CENTER",
    entityType: "VERIFICATION",
    entityId: result.id,
    actorId: reviewedBy,
    data: result,
  });

  return result;
}
