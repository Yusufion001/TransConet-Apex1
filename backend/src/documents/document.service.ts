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
  fileUrl: string;
}) {
  const document = await prisma.document.create({
    data: {
      ...data,
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
  const document = await prisma.document.update({
    where: { id: documentId },
    data: {
      status: "APPROVED",
      adminApproved: true,
      adminApprovedAt: new Date(),
      reviewedBy,
    },
  });

  publishEvent("admin", {
    eventType: "DOCUMENT_APPROVED",
    module: "VERIFICATION_CENTER",
    entityType: "DOCUMENT",
    entityId: document.id,
    actorId: reviewedBy,
    data: document,
  });

  return document;
}

export async function rejectDocument(
  documentId: string,
  reviewedBy: string,
  rejectionReason: string,
) {
  const document = await prisma.document.update({
    where: { id: documentId },
    data: {
      status: "REJECTED",
      reviewedBy,
      rejectionReason,
    },
  });

  publishEvent("admin", {
    eventType: "DOCUMENT_REJECTED",
    module: "VERIFICATION_CENTER",
    entityType: "DOCUMENT",
    entityId: document.id,
    actorId: reviewedBy,
    data: document,
  });

  return document;
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
