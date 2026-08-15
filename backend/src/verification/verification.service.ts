import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";

export async function startVerification(
  documentId: string,
) {
  const existingDocument =
    await prisma.document.findUnique({
      where: {
        id: documentId,
      },
    });

  if (!existingDocument) {
    throw new Error(
      "Document not found",
    );
  }

  const document = await prisma.document.update({
    where: {
      id: documentId,
    },
    data: {
      verificationProvider:
        "PENDING_PROVIDER_SELECTION",
      providerResponse: {
        status: "QUEUED",
      },
    },
  });

  publishEvent("admin", {
    eventType: "VERIFICATION_STARTED",
    module: "VERIFICATION_CENTER",
    entityType: "DOCUMENT",
    entityId: document.id,
    data: document,
  });

  return document;
}
export async function completeVerification(
  documentId: string,
  provider: string,
  externalVerificationId: string,
  providerResponse: any,
) {
  const document = await prisma.document.update({
    where: {
      id: documentId,
    },
    data: {
      verificationProvider: provider,
      externalVerificationId,
      providerResponse,
      verifiedAt: new Date(),
    },
  });

  publishEvent("admin", {
    eventType: "VERIFICATION_COMPLETED",
    module: "VERIFICATION_CENTER",
    entityType: "DOCUMENT",
    entityId: document.id,
    data: document,
  });

  return document;
}
