import { prisma } from "../config/prisma.js";

export async function getTransporterOnboardingStatus(transporterId: string) {
  const user = await prisma.user.findUnique({
    where: { id: transporterId },
    select: {
      id: true,
      role: true,
      status: true,
      emailVerifiedAt: true,
      transporterTier: true,
    },
  });

  if (!user) {
    throw new Error("Transporter not found");
  }

  if (user.role !== "TRANSPORTER") {
    throw new Error("User is not a transporter");
  }

  const [profile, documents, vehicles] = await Promise.all([
    prisma.transporterProfile.findUnique({
      where: { userId: transporterId },
      select: {
        companyName: true,
        businessRegistrationNumber: true,
        address: true,
        city: true,
        state: true,
        country: true,
        verificationStatus: true,
        tier2Approved: true,
      },
    }),

    prisma.document.findMany({
      where: { userId: transporterId },
      select: {
        id: true,
        type: true,
        status: true,
        verificationProvider: true,
        externalVerificationId: true,
        verifiedAt: true,
        adminApproved: true,
        rejectionReason: true,
      },
      orderBy: { createdAt: "desc" },
    }),

    prisma.vehicle.findMany({
      where: { transporterId },
      select: {
        id: true,
        registrationNumber: true,
        vehicleType: true,
        vehicleClass: true,
        verificationStatus: true,
        availabilityStatus: true,
        currentLatitude: true,
        currentLongitude: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const emailVerified = Boolean(user.emailVerifiedAt);

  const profileCompleted = profile !== null && (
    Boolean(profile.companyName) &&
    Boolean(profile.address) &&
    Boolean(profile.city) &&
    Boolean(profile.state) &&
    Boolean(profile.country)
  );

  const identityDocuments = documents.filter(
    (document) => document.type === "IDENTITY_DOCUMENT",
  );

  const approvedIdentityDocument = identityDocuments.some(
    (document) =>
      document.status === "APPROVED" &&
      document.adminApproved &&
      document.verificationProvider === "YOUVERIFY" &&
      Boolean(document.externalVerificationId) &&
      Boolean(document.verifiedAt),
  );

  const pendingIdentityVerification = identityDocuments.some(
    (document) =>
      document.verificationProvider === "YOUVERIFY" &&
      Boolean(document.externalVerificationId) &&
      !document.verifiedAt &&
      document.status === "PENDING",
  );

  const identityRejected = identityDocuments.some(
    (document) => document.status === "REJECTED",
  );

  const insuranceDocuments = documents.filter(
    (document) => document.type === "INSURANCE",
  );

  const businessDocuments = documents.filter(
    (document) => document.type === "BUSINESS_DOCUMENT",
  );

  const approvedInsurance = insuranceDocuments.some(
    (document) =>
      document.status === "APPROVED" &&
      document.adminApproved,
  );

  const approvedBusinessDocument = businessDocuments.some(
    (document) =>
      document.status === "APPROVED" &&
      document.adminApproved,
  );

  const tier2DocumentsSubmitted =
    insuranceDocuments.length > 0 &&
    businessDocuments.length > 0;

  const tier2RequirementsMet =
    approvedInsurance &&
    approvedBusinessDocument;

  const registeredVehicle = vehicles.length > 0;

  const approvedVehicle = vehicles.some(
    (vehicle) => vehicle.verificationStatus === "APPROVED",
  );

  const availableVehicle = vehicles.some(
    (vehicle) => vehicle.availabilityStatus === "AVAILABLE",
  );

  const locatedVehicle = vehicles.some(
    (vehicle) =>
      vehicle.currentLatitude !== null &&
      vehicle.currentLongitude !== null,
  );

  /*
   * Transporter approval is deliberately separate from
   * individual document approval.
   */
  const adminApproved =
    profile?.verificationStatus === "APPROVED";

  /*
   * Tier 2 is never inferred automatically.
   *
   * It requires:
   * - insurance certificate approved;
   * - business certificate approved;
   * - explicit administrator Tier 2 approval.
   */
  const tier2Approved =
    user.transporterTier === "TIER_2" &&
    profile?.tier2Approved === true &&
    tier2RequirementsMet;

  /*
   * Marketplace readiness follows the existing backend
   * marketplace eligibility requirements.
   *
   * We do not change Marketplace visibility rules here.
   */
  const marketplaceReady =
    user.status === "ACTIVE" &&
    emailVerified &&
    profileCompleted &&
    approvedIdentityDocument &&
    registeredVehicle &&
    approvedVehicle &&
    availableVehicle &&
    locatedVehicle &&
    adminApproved;

  let currentStep:
    | "EMAIL_VERIFICATION"
    | "PROFILE_SETUP"
    | "DOCUMENTS"
    | "YOUVERIFY"
    | "VEHICLE"
    | "ADMIN_REVIEW"
    | "APPROVED"
    | "TIER_2_DOCUMENTS"
    | "TIER_2_APPROVAL";

  if (!emailVerified) {
    currentStep = "EMAIL_VERIFICATION";
  } else if (!profileCompleted) {
    currentStep = "PROFILE_SETUP";
  } else if (!identityDocuments.length) {
    currentStep = "DOCUMENTS";
  } else if (
    identityRejected ||
    (!approvedIdentityDocument && !pendingIdentityVerification)
  ) {
    currentStep = "YOUVERIFY";
  } else if (!registeredVehicle || !approvedVehicle) {
    currentStep = "VEHICLE";
  } else if (!adminApproved) {
    currentStep = "ADMIN_REVIEW";
  } else if (
    user.transporterTier === "TIER_2" &&
    (!tier2RequirementsMet || !profile?.tier2Approved)
  ) {
    currentStep = tier2DocumentsSubmitted
      ? "TIER_2_APPROVAL"
      : "TIER_2_DOCUMENTS";
  } else {
    currentStep = "APPROVED";
  }

  return {
    transporterId: user.id,
    accountStatus: user.status,
    emailVerified,

    profile: {
      exists: Boolean(profile),
      completed: profileCompleted,
      verificationStatus: profile?.verificationStatus ?? null,
    },

    identity: {
      submitted: identityDocuments.length > 0,
      youverifyVerified: approvedIdentityDocument,
      verificationPending: pendingIdentityVerification,
      rejected: identityRejected,
    },

    vehicle: {
      registered: registeredVehicle,
      approved: approvedVehicle,
      available: availableVehicle,
      locationReady: locatedVehicle,
    },

    adminApproval: {
      approved: adminApproved,
    },

    tier: user.transporterTier ?? "TIER_1",

    tier2: {
      insuranceSubmitted: insuranceDocuments.length > 0,
      insuranceApproved: approvedInsurance,
      businessCertificateSubmitted: businessDocuments.length > 0,
      businessCertificateApproved: approvedBusinessDocument,
      requirementsMet: tier2RequirementsMet,
      approved: tier2Approved,
    },

    marketplaceReady,
    currentStep,
  };
}
