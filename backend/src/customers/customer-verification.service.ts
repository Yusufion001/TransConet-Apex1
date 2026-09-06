import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";
import {
  extractYouverifyVerificationId,
  verifyIdentity,
  type YouverifyResponse,
} from "../verification/youverify/youverify.service.js";

export type CustomerVerificationType = "NIN" | "DRIVERS_LICENSE";

interface StartCustomerVerificationInput {
  userId: string;
  type: CustomerVerificationType;
  verificationNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
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

export async function startCustomerVerification(
  input: StartCustomerVerificationInput,
) {
  if (!input.subjectConsent) {
    throw new Error("Subject consent is required for verification");
  }

  const verificationNumber = normalizeVerificationNumber(
    input.verificationNumber,
  );

  if (!verificationNumber) {
    throw new Error("Government ID number is required");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: input.userId,
    },
    select: {
      id: true,
      role: true,
      customerProfile: {
        select: {
          userId: true,
          customerType: true,
        },
      },
    },
  });

  if (!user || user.role !== "CUSTOMER") {
    throw new Error("Customer account not found");
  }

  if (!user.customerProfile) {
    throw new Error("Customer profile not found");
  }

  let providerResponse: YouverifyResponse;

  if (input.type === "NIN") {
    providerResponse = await verifyIdentity({
      type: "nin",
      id: verificationNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth,
      subjectConsent: input.subjectConsent,
    });
  } else {
    providerResponse = await verifyIdentity({
      type: "drivers_license",
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
      verifiedAt:
        providerStatus === "SUCCESS" ? new Date() : null,
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
