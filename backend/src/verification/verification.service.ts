import { prisma } from "../config/prisma.js";
import type * as Prisma from "../../generated/prisma/internal/prismaNamespace.js";
import { publishEvent } from "../realtime/event-bus.js";
import {
  verifyIdentity,
  type YouverifyVerificationType,
} from "./youverify/youverify.service.js";

const documentTypeToVerificationType: Record<
  string,
  YouverifyVerificationType
> = {
  IDENTITY_DOCUMENT: "nin",
  DRIVERS_LICENSE: "drivers_license",
};

function getExternalVerificationId(
  response: {
    data?: {
      id?: unknown;
      reference_id?: unknown;
      referenceId?: unknown;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  },
): string | undefined {
  const data = response.data;

  if (!data) {
    return undefined;
  }

  const id =
    data.id ??
    data.reference_id ??
    data.referenceId;

  return typeof id === "string" && id.trim()
    ? id.trim()
    : undefined;
}

export async function startVerification(
  documentId: string,
  userId: string,
  verificationType?: YouverifyVerificationType,
  verificationId?: string,
  firstName?: string,
  lastName?: string,
  dateOfBirth?: string,
  subjectConsent = false,
  selfieImage?: string,
) {
  const existingDocument =
    await prisma.document.findUnique({
      where: {
        id: documentId,
      },
    });

  if (!existingDocument) {
    throw new Error("Document not found");
  }

  if (existingDocument.userId !== userId) {
    throw new Error("Access denied");
  }

  if (existingDocument.status === "APPROVED") {
    throw new Error("Document is already approved");
  }

  if (!verificationType) {
    verificationType =
      documentTypeToVerificationType[
        existingDocument.type
      ];
  }

  if (!verificationType) {
    throw new Error(
      `Document type ${existingDocument.type} is not supported for Youverify identity verification`,
    );
  }

  if (!verificationId?.trim()) {
    throw new Error(
      "Verification identifier is required",
    );
  }

  if (!subjectConsent) {
    throw new Error(
      "Subject consent is required for Youverify verification",
    );
  }

  const providerResponse =
    await verifyIdentity({
      type: verificationType,
      id: verificationId.trim(),
      firstName,
      lastName,
      dateOfBirth,
      subjectConsent,
      selfieImage,
    });

  const externalVerificationId =
    getExternalVerificationId(providerResponse);

  if (!externalVerificationId) {
    throw new Error(
      "Youverify response did not contain a verification ID",
    );
  }

  const document =
    await prisma.document.update({
      where: {
        id: documentId,
      },
      data: {
        verificationProvider: "YOUVERIFY",
        externalVerificationId,
        providerResponse:
          providerResponse as Prisma.InputJsonValue,
        status: "PENDING",
        verifiedAt: null,
      },
    });

  publishEvent("admin", {
    eventType: "VERIFICATION_STARTED",
    module: "VERIFICATION_CENTER",
    entityType: "DOCUMENT",
    entityId: document.id,
    actorId: userId,
    data: document,
  });

  return document;
}

export async function completeVerification(
  documentId: string,
  provider: string,
  externalVerificationId: string,
  providerResponse: Prisma.InputJsonValue,
) {
  const document =
    await prisma.document.update({
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
