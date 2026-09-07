import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";
import { createNotification } from "../notifications/notification.service.js";
import { supabaseStorageService } from "../storage/supabase-storage.service.js";

type AdminDisputeStatus =
  | "OPEN"
  | "INVESTIGATING"
  | "RESOLVED"
  | "REJECTED";

async function requireDisputeAdministrator(administratorId: string) {
  const administrator = await prisma.adminProfile.findUnique({
    where: { userId: administratorId },
    select: {
      status: true,
      isSuperAdministrator: true,
      administratorType: true,
      assignedModules: true,
    },
  });

  if (!administrator) {
    throw new Error("Administrator profile not found");
  }

  if (administrator.status !== "ACTIVE") {
    throw new Error("Administrator account is not active");
  }

  if (
    administrator.isSuperAdministrator ||
    administrator.administratorType === "SUPER_ADMIN"
  ) {
    return administrator;
  }

  if (!administrator.assignedModules.includes("DISPUTES")) {
    throw new Error(
      "Administrator is not authorized for DISPUTES",
    );
  }

  return administrator;
}

async function getDispute(id: string) {
  const dispute = await prisma.dispute.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
        },
      },
      transporter: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
        },
      },
      administrator: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          status: true,
        },
      },
      booking: {
        select: {
          id: true,
          status: true,
          pickupLocation: true,
          pickupLatitude: true,
          pickupLongitude: true,
          scheduledDate: true,
          pickedUpAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!dispute) {
    throw new Error("Dispute not found");
  }

  const evidence =
    dispute.evidence &&
    typeof dispute.evidence === "object"
      ? dispute.evidence as {
          pickup?: {
            location?: string | null;
            latitude?: number | null;
            longitude?: number | null;
            scheduledDate?: string | null;
            pickedUpAt?: string | null;
          };
          media?: Array<{
            type: "IMAGE" | "VIDEO";
            storagePath: string;
            fileName: string;
            mimeType: string;
          }>;
        }
      : null;

  const media = await Promise.all(
    (evidence?.media ?? []).map(async (item) => {
      const signed = await supabaseStorageService.createSignedDownloadUrl(
        item.storagePath,
        3600,
      );

      return {
        ...item,
        signedUrl: signed.signedUrl,
      };
    }),
  );

  return {
    ...dispute,
    evidence: evidence
      ? {
          ...evidence,
          media,
        }
      : null,
  };
}

export async function getAdminDisputes(filters?: {
  status?: AdminDisputeStatus;
  search?: string;
}) {
  const search = filters?.search?.trim();

  const disputes = await prisma.dispute.findMany({
    where: {
      ...(filters?.status
        ? { status: filters.status }
        : {}),
      ...(search
        ? {
            OR: [
              {
                reason: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                customer: {
                  OR: [
                    {
                      firstName: {
                        contains: search,
                        mode: "insensitive",
                      },
                    },
                    {
                      lastName: {
                        contains: search,
                        mode: "insensitive",
                      },
                    },
                    {
                      email: {
                        contains: search,
                        mode: "insensitive",
                      },
                    },
                  ],
                },
              },
              {
                transporter: {
                  OR: [
                    {
                      firstName: {
                        contains: search,
                        mode: "insensitive",
                      },
                    },
                    {
                      lastName: {
                        contains: search,
                        mode: "insensitive",
                      },
                    },
                    {
                      email: {
                        contains: search,
                        mode: "insensitive",
                      },
                    },
                  ],
                },
              },
            ],
          }
        : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
        },
      },
      transporter: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
        },
      },
      administrator: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          status: true,
        },
      },
      booking: {
        select: {
          id: true,
          status: true,
          pickupLocation: true,
          pickupLatitude: true,
          pickupLongitude: true,
          scheduledDate: true,
          pickedUpAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  return disputes;
}

export async function getAdminDispute(
  disputeId: string,
  administratorId: string,
) {
  await requireDisputeAdministrator(administratorId);
  return getDispute(disputeId);
}

export async function assignAdminDispute(
  disputeId: string,
  assigneeId: string,
  administratorId: string,
) {
  await requireDisputeAdministrator(administratorId);
  await requireDisputeAdministrator(assigneeId);

  const existing = await getDispute(disputeId);

  const updated = await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      administratorId: assigneeId,
    },
  });

  await prisma.auditLog.create({
    data: {
      administratorId,
      affectedUserId: existing.customerId,
      affectedBookingId: existing.bookingId,
      action: "DISPUTE_ASSIGNED",
      previousValue: {
        administratorId: existing.administratorId,
      },
      newValue: {
        administratorId: assigneeId,
      },
    },
  });

  publishEvent("admin", {
    eventType: "DISPUTE_ASSIGNED",
    module: "DISPUTES",
    entityType: "DISPUTE",
    entityId: disputeId,
    actorId: administratorId,
    data: updated,
  });

  return getDispute(disputeId);
}

export async function updateAdminDispute(
  disputeId: string,
  status: AdminDisputeStatus,
  resolution: string | undefined,
  administratorId: string,
) {
  await requireDisputeAdministrator(administratorId);

  const existing = await getDispute(disputeId);

  if (
    existing.status === "RESOLVED" ||
    existing.status === "REJECTED"
  ) {
    throw new Error("Resolved or rejected disputes cannot be changed");
  }

  if (
    status === "OPEN" &&
    existing.status !== "OPEN"
  ) {
    throw new Error(
      "A dispute cannot be moved back to OPEN",
    );
  }

  if (
    status === "RESOLVED" &&
    existing.status !== "INVESTIGATING"
  ) {
    throw new Error(
      "Only investigating disputes can be resolved",
    );
  }

  if (
    status === "REJECTED" &&
    existing.status !== "INVESTIGATING"
  ) {
    throw new Error(
      "Only investigating disputes can be rejected",
    );
  }

  const updated = await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      status,
      ...(resolution !== undefined
        ? { resolution }
        : {}),
      ...(status === "INVESTIGATING"
        ? { administratorId }
        : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      administratorId,
      affectedUserId: existing.customerId,
      affectedBookingId: existing.bookingId,
      action: `DISPUTE_${status}`,
      previousValue: {
        status: existing.status,
        resolution: existing.resolution,
        administratorId: existing.administratorId,
      },
      newValue: {
        status: updated.status,
        resolution: updated.resolution,
        administratorId: updated.administratorId,
      },
    },
  });

  const statusText = status
    .replace("_", " ")
    .toLowerCase();

  await createNotification({
    recipientId: existing.customerId,
    type: "DISPUTE_STATUS_UPDATED",
    title: "Dispute updated",
    message: `Your dispute is now ${statusText}.`,
    relatedType: "DISPUTE",
    relatedId: existing.id,
    actorId: administratorId,
  });

  if (existing.transporterId) {
    await createNotification({
      recipientId: existing.transporterId,
      type: "DISPUTE_STATUS_UPDATED",
      title: "Dispute updated",
      message: `A dispute involving your booking is now ${statusText}.`,
      relatedType: "DISPUTE",
      relatedId: existing.id,
      actorId: administratorId,
    });
  }

  publishEvent("admin", {
    eventType: "DISPUTE_STATUS_UPDATED",
    module: "DISPUTES",
    entityType: "DISPUTE",
    entityId: disputeId,
    actorId: administratorId,
    data: updated,
  });

  publishEvent("booking", {
    eventType: "DISPUTE_STATUS_UPDATED",
    module: "DISPUTES",
    entityType: "DISPUTE",
    entityId: disputeId,
    actorId: administratorId,
    bookingId: existing.bookingId,
    data: updated,
  });

  return getDispute(disputeId);
}
