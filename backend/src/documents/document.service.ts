import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";

export async function createDocument(data: {
  userId: string;
  type:
    | "DRIVERS_LICENSE"
    | "VEHICLE_REGISTRATION"
    | "INSURANCE"
    | "BUSINESS_DOCUMENT"
    | "IDENTITY_DOCUMENT"
    | "OTHER";
  fileUrl?: string;
  storagePath?: string;
}) {
  const document = await prisma.document.create({
    data: {
      userId: data.userId,
      type: data.type,
      fileUrl: data.fileUrl ?? data.storagePath!,
      storagePath: data.storagePath ?? null,
      verificationProvider: null,
      externalVerificationId: null,
      providerResponse: undefined,
      verifiedAt: null,
      adminApproved: false,
      adminApprovedAt: null,
      status: "PENDING",
    },
  });

  publishEvent("admin", {
    eventType: "DOCUMENT_SUBMITTED",
    module: "VERIFICATION_CENTER",
    entityType: "DOCUMENT",
    entityId: document.id,
    actorId: data.userId,
    data: document,
  });

  return document;
}

export async function getUserDocuments(
  userId: string,
) {
  return prisma.document.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}
export async function approveDocument(
  documentId: string,
  reviewedBy: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const existingDocument = await tx.document.findUnique({
      where: { id: documentId },
      include: {
        user: {
          select: {
            id: true,
            role: true,
          },
        },
      },
    });

    if (!existingDocument) {
      throw new Error("Document not found");
    }

    if (existingDocument.status === "APPROVED") {
      throw new Error("Document is already approved");
    }

      const requiresYouverify = [
      "IDENTITY_DOCUMENT",
      "DRIVERS_LICENSE",
    ].includes(existingDocument.type);

    if (
      requiresYouverify &&
      (
        existingDocument.verificationProvider !== "YOUVERIFY" ||
        !existingDocument.externalVerificationId ||
        !existingDocument.verifiedAt
      )
    ) {
      throw new Error(
        "This document must have a successful Youverify verification before admin approval",
      );
    }

    const document = await tx.document.update({
      where: { id: documentId },
      data: {
        status: "APPROVED",
        adminApproved: true,
        adminApprovedAt: new Date(),
        reviewedBy,
      },
    });

    if (existingDocument.type === "IDENTITY_DOCUMENT") {
      if (existingDocument.user.role === "CUSTOMER") {
        await tx.customerProfile.update({
          where: {
            userId: existingDocument.user.id,
          },
          data: {
            verificationStatus: "APPROVED",
          },
        });
      }

    }

    return document;
  });

  publishEvent("admin", {
    eventType: "DOCUMENT_APPROVED",
    module: "VERIFICATION_CENTER",
    entityType: "DOCUMENT",
    entityId: result.id,
    actorId: reviewedBy,
    data: result,
  });

  return result;
}

export async function rejectDocument(
  documentId: string,
  reviewedBy: string,
  rejectionReason: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const existingDocument = await tx.document.findUnique({
      where: { id: documentId },
      include: {
        user: {
          select: {
            id: true,
            role: true,
          },
        },
      },
    });

    if (!existingDocument) {
      throw new Error("Document not found");
    }

    if (existingDocument.status === "REJECTED") {
      throw new Error("Document is already rejected");
    }

    const document = await tx.document.update({
      where: { id: documentId },
      data: {
        status: "REJECTED",
        adminApproved: false,
        adminApprovedAt: null,
        reviewedBy,
        rejectionReason,
      },
    });

    if (existingDocument.type === "IDENTITY_DOCUMENT") {
      const anotherApprovedIdentityDocument =
        await tx.document.findFirst({
          where: {
            userId: existingDocument.user.id,
            type: "IDENTITY_DOCUMENT",
            status: "APPROVED",
            id: {
              not: existingDocument.id,
            },
          },
          select: {
            id: true,
          },
        });

      if (!anotherApprovedIdentityDocument) {
        if (existingDocument.user.role === "CUSTOMER") {
          await tx.customerProfile.update({
            where: {
              userId: existingDocument.user.id,
            },
            data: {
              verificationStatus: "REJECTED",
            },
          });
        }

        if (existingDocument.user.role === "TRANSPORTER") {
          await tx.transporterProfile.update({
            where: {
              userId: existingDocument.user.id,
            },
            data: {
              verificationStatus: "REJECTED",
            },
          });
        }
      }
    }

    return document;
  });

  publishEvent("admin", {
    eventType: "DOCUMENT_REJECTED",
    module: "VERIFICATION_CENTER",
    entityType: "DOCUMENT",
    entityId: result.id,
    actorId: reviewedBy,
    data: result,
  });

  return result;
}

export async function getPendingDocuments() {
  return prisma.document.findMany({
    where: {
      status: "PENDING",
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

export async function getVerifiedDocuments() {
  return prisma.document.findMany({
    where: {
      status: "APPROVED",
    },
    orderBy: {
      verifiedAt: "desc",
    },
  });
}
