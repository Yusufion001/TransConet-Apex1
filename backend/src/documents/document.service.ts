import { prisma } from "../config/prisma.js";

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
  return prisma.document.create({
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
  return prisma.document.update({
    where: { id: documentId },
    data: {
      status: "APPROVED",
      adminApproved: true,
      adminApprovedAt: new Date(),
      reviewedBy,
    },
  });
}

export async function rejectDocument(
  documentId: string,
  reviewedBy: string,
  rejectionReason: string,
) {
  return prisma.document.update({
    where: { id: documentId },
    data: {
      status: "REJECTED",
      reviewedBy,
      rejectionReason,
    },
  });
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
