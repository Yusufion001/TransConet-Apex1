import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";
import {
  extractYouverifyVerificationId,
  verifyBusinessRegistration,
  verifyIdentity,
  type YouverifyResponse,
} from "../verification/youverify/youverify.service.js";

export type TransporterVerificationType =
  | "NIN"
  | "DRIVERS_LICENSE"
  | "BUSINESS_REGISTRATION";

interface StartTransporterVerificationInput {
  userId: string;
  type: TransporterVerificationType;
  verificationNumber: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  subjectConsent: boolean;
}

function normalizeVerificationNumber(value: string): string {
  return value.trim();
}

function getProviderStatus(
  response: YouverifyResponse,
): "SUCCESS" | "FAILED" | "PENDING" {
  const status = String(response.data?.status ?? "").toUpperCase();

  if (
    ["VERIFIED", "FOUND", "COMPLETED", "SUCCESS"].includes(status) ||
    response.success === true
  ) {
    return "SUCCESS";
  }

  if (
    ["FAILED", "REJECTED", "NOT_FOUND"].includes(status) ||
    response.success === false
  ) {
    return "FAILED";
  }

  return "PENDING";
}

export async function startTransporterVerification(
  input: StartTransporterVerificationInput,
) {
  if (!input.subjectConsent) {
    throw new Error("Subject consent is required for verification");
  }

  const verificationNumber = normalizeVerificationNumber(
    input.verificationNumber,
  );

  if (!verificationNumber) {
    throw new Error("Verification number is required");
  }

  const profile = await prisma.transporterProfile.findUnique({
    where: {
      userId: input.userId,
    },
    select: {
      userId: true,
      transporterType: true,
    },
  });

  if (!profile) {
    throw new Error("Transporter profile not found");
  }

  if (
    input.type === "BUSINESS_REGISTRATION" &&
    profile.transporterType !== "BUSINESS"
  ) {
    throw new Error(
      "Business registration verification is only available to BUSINESS transporters",
    );
  }

  let providerResponse: YouverifyResponse;

  if (input.type === "BUSINESS_REGISTRATION") {
    providerResponse = await verifyBusinessRegistration({
      registrationNumber: verificationNumber,
      subjectConsent: input.subjectConsent,
    });
  } else {
    const youverifyType =
      input.type === "NIN" ? "nin" : "drivers_license";

    providerResponse = await verifyIdentity({
      type: youverifyType,
      id: verificationNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth,
      subjectConsent: input.subjectConsent,
    });
  }

  const externalVerificationId =
    extractYouverifyVerificationId(providerResponse);

  if (!externalVerificationId) {
    throw new Error(
      "Youverify response did not contain a verification ID",
    );
  }

  const providerStatus = getProviderStatus(providerResponse);

  const verification = await prisma.verification.create({
    data: {
      userId: input.userId,
      type: input.type,
      verificationNumber,
      verificationProvider: "YOUVERIFY",
      externalVerificationId,
      providerStatus,
      providerResponse: providerResponse as any,
      verifiedAt: providerStatus === "SUCCESS" ? new Date() : null,
      adminStatus: "PENDING",
      adminApproved: false,
    },
  });

  publishEvent("admin", {
    eventType: "VERIFICATION_STARTED",
    module: "VERIFICATION_CENTER",
    entityType: "VERIFICATION",
    entityId: verification.id,
    actorId: input.userId,
    data: verification,
  });

  return verification;
}
