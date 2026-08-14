import { prisma } from "../config/prisma.js";

export async function startVerification(
  documentId: string,
) {
  const document =
    await prisma.document.findUnique({
      where: {
        id: documentId,
      },
    });

  if (!document) {
    throw new Error(
      "Document not found",
    );
  }

  return prisma.document.update({
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
}
export async function completeVerification(
  documentId: string,
  provider: string,
  externalVerificationId: string,
  providerResponse: any,
) {
  return prisma.document.update({
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
}
