import { createHash, randomBytes, randomInt } from "node:crypto";
import { prisma } from "../config/prisma.js";
import { sendSms } from "../services/termii.service.js";
import { sendContactChangeVerificationEmail } from "../services/email.service.js";
import { env } from "../config/env.js";
import { youverifyClient } from "../verification/youverify.client.js";
import { publishEvent } from "../realtime/event-bus.js";

type ContactChangeType = "EMAIL" | "PHONE";

type LivenessTokenResponse = {
  data?: {
    authToken?: string;
    sessionId?: string;
  };
};

function hashContactVerificationToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function createEmailVerificationToken() {
  return randomBytes(32).toString("hex");
}

function createPhoneVerificationCode() {
  return randomInt(100000, 1000000).toString();
}

const MAX_CONTACT_VERIFICATION_ATTEMPTS = 5;

function getContactVerificationExpiry() {
  return new Date(Date.now() + 10 * 60 * 1000);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  return value.trim();
}

function getAuthToken(response: LivenessTokenResponse) {
  return response.data?.authToken;
}

function getSessionId(response: LivenessTokenResponse) {
  return response.data?.sessionId;
}

export async function startContactChange(input: {
  userId: string;
  type: ContactChangeType;
  requestedValue: string;
  deviceCorrelationId: string;
}) {
  const requestedValue =
    input.type === "EMAIL"
      ? normalizeEmail(input.requestedValue)
      : normalizePhone(input.requestedValue);

  if (!requestedValue) {
    throw new Error("A new contact value is required");
  }

  if (!input.deviceCorrelationId.trim()) {
    throw new Error("Device correlation ID is required");
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      email: true,
      phone: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const currentValue =
    input.type === "EMAIL" ? user.email : user.phone;

  if (!currentValue) {
    throw new Error(
      `No current ${input.type.toLowerCase()} is registered on this account`,
    );
  }

  const normalizedCurrent =
    input.type === "EMAIL"
      ? normalizeEmail(currentValue)
      : normalizePhone(currentValue);

  if (requestedValue === normalizedCurrent) {
    throw new Error(
      `The new ${input.type.toLowerCase()} must be different from the current one`,
    );
  }

  const conflictingUser =
    input.type === "EMAIL"
      ? await prisma.user.findFirst({
          where: {
            email: requestedValue,
            NOT: { id: user.id },
          },
          select: { id: true },
        })
      : await prisma.user.findFirst({
          where: {
            phone: requestedValue,
            NOT: { id: user.id },
          },
          select: { id: true },
        });

  if (conflictingUser) {
    throw new Error(
      `That ${input.type.toLowerCase()} is already in use`,
    );
  }

  const now = new Date();

  await prisma.contactChange.updateMany({
    where: {
      userId: user.id,
      status: {
        in: [
          "PENDING_LIVENESS",
          "LIVENESS_VERIFIED",
          "PENDING_CONTACT_VERIFICATION",
        ],
      },
      expiresAt: { lt: now },
    },
    data: {
      status: "EXPIRED",
    },
  });

  const existing = await prisma.contactChange.findFirst({
    where: {
      userId: user.id,
      type: input.type,
      status: {
        in: [
          "PENDING_LIVENESS",
          "LIVENESS_VERIFIED",
          "PENDING_CONTACT_VERIFICATION",
        ],
      },
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    throw new Error("You already have a contact change in progress");
  }

  const livenessToken =
    await youverifyClient.generateLivenessToken({
      publicMerchantID: env.YOUVERIFY_PUBLIC_MERCHANT_ID,
      deviceCorrelationId: input.deviceCorrelationId.trim(),
    });

  const authToken = getAuthToken(livenessToken);

  if (!authToken) {
    throw new Error(
      "Youverify did not return a liveness authentication token",
    );
  }

  const sessionId = getSessionId(livenessToken);

  if (!sessionId) {
    throw new Error(
      "Youverify did not return a liveness session ID",
    );
  }

  // The token operation owns the liveness session used by the SDK.
  // Persist its sessionId so subsequent history verification targets
  // the exact liveness operation that issued the auth token.
  const sessionExpiresAt = new Date(Date.now() + 120_000);

  const expiresAt = new Date(
    Math.min(
      sessionExpiresAt.getTime(),
      Date.now() + 10 * 60 * 1000,
    ),
  );

  const contactChange = await prisma.contactChange.create({
    data: {
      userId: user.id,
      type: input.type,
      status: "PENDING_LIVENESS",
      currentValue,
      requestedValue,
      livenessSessionId: sessionId,
      livenessSessionExpiresAt: sessionExpiresAt,
      expiresAt,
    },
  });

  publishEvent("admin", {
    eventType: "CONTACT_CHANGE_STARTED",
    module: "SECURITY_CENTER",
    entityType: "CONTACT_CHANGE",
    entityId: contactChange.id,
    actorId: input.userId,
    data: {
      type: contactChange.type,
      status: contactChange.status,
    },
  });

  return {
    contactChangeId: contactChange.id,
    type: contactChange.type,
    status: contactChange.status,
    requestedValue: contactChange.requestedValue,
    liveness: {
      sessionId,
      authToken,
      expiresAt: sessionExpiresAt,
    },
  };
}

export async function verifyContactChangeLiveness(input: {
  userId: string;
  contactChangeId: string;
}) {
  const contactChange = await prisma.contactChange.findFirst({
    where: {
      id: input.contactChangeId,
      userId: input.userId,
    },
    select: {
      id: true,
      type: true,
      status: true,
      livenessSessionId: true,
      livenessSessionExpiresAt: true,
      livenessVerifiedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  if (!contactChange) {
    throw new Error("Contact change not found");
  }

  if (contactChange.status !== "PENDING_LIVENESS") {
    if (contactChange.status === "LIVENESS_VERIFIED") {
      return {
        contactChangeId: contactChange.id,
        status: contactChange.status,
        alreadyVerified: true,
        livenessVerifiedAt: contactChange.livenessVerifiedAt,
      };
    }

    throw new Error("Contact change is not awaiting liveness verification");
  }

  if (!contactChange.livenessSessionId) {
    throw new Error("Contact change has no liveness session");
  }

  const now = new Date();

  if (contactChange.expiresAt <= now) {
    await prisma.contactChange.updateMany({
      where: {
        id: contactChange.id,
        userId: input.userId,
        status: "PENDING_LIVENESS",
      },
      data: {
        status: "EXPIRED",
      },
    });

    throw new Error("Contact change has expired");
  }

  if (
    contactChange.livenessSessionExpiresAt &&
    contactChange.livenessSessionExpiresAt <= now
  ) {
    await prisma.contactChange.updateMany({
      where: {
        id: contactChange.id,
        userId: input.userId,
        status: "PENDING_LIVENESS",
      },
      data: {
        status: "EXPIRED",
      },
    });

    throw new Error("Liveness session has expired");
  }

  const history =
    await youverifyClient.getLivenessHistory(
      contactChange.livenessSessionId,
    );

  const records = history.data?.docs ?? [];

  const matchingRecord = records.find(
    (record) =>
      record.sessionId === contactChange.livenessSessionId,
  );

  if (!matchingRecord) {
    throw new Error(
      "Youverify has not completed liveness verification for this session",
    );
  }

  if (matchingRecord.passed !== true) {
    throw new Error("Liveness verification was not passed");
  }

  if (matchingRecord.createdAt) {
    const completedAt = new Date(matchingRecord.createdAt);

    if (
      Number.isNaN(completedAt.getTime()) ||
      completedAt < contactChange.createdAt ||
      completedAt > now
    ) {
      throw new Error("Invalid liveness verification timestamp");
    }
  }

  const updateResult = await prisma.contactChange.updateMany({
    where: {
      id: contactChange.id,
      userId: input.userId,
      status: "PENDING_LIVENESS",
      livenessSessionId: contactChange.livenessSessionId,
    },
    data: {
      status: "LIVENESS_VERIFIED",
      livenessVerifiedAt: now,
    },
  });

  if (updateResult.count === 0) {
    const latest = await prisma.contactChange.findFirst({
      where: {
        id: contactChange.id,
        userId: input.userId,
      },
      select: {
        id: true,
        status: true,
        livenessVerifiedAt: true,
      },
    });

    if (latest?.status === "LIVENESS_VERIFIED") {
      return {
        contactChangeId: latest.id,
        status: latest.status,
        alreadyVerified: true,
        livenessVerifiedAt: latest.livenessVerifiedAt,
      };
    }

    throw new Error(
      "Contact change could not be updated because its state changed",
    );
  }

    publishEvent("admin", {
      eventType: "CONTACT_CHANGE_LIVENESS_VERIFIED",
      module: "SECURITY_CENTER",
      entityType: "CONTACT_CHANGE",
      entityId: contactChange.id,
      actorId: input.userId,
      data: {
        type: contactChange.type,
        status: "LIVENESS_VERIFIED",
      },
    });

  return {
    contactChangeId: contactChange.id,
    status: "LIVENESS_VERIFIED" as const,
    alreadyVerified: false,
    livenessVerifiedAt: now,
  };
}


export async function startContactChangeVerification(input: {
  userId: string;
  contactChangeId: string;
}) {
  const contactChange = await prisma.contactChange.findFirst({
    where: {
      id: input.contactChangeId,
      userId: input.userId,
    },
    select: {
      id: true,
      type: true,
      status: true,
      requestedValue: true,
      expiresAt: true,
      contactVerificationExpiresAt: true,
    },
  });

  if (!contactChange) {
    throw new Error("Contact change not found");
  }

  if (contactChange.status !== "LIVENESS_VERIFIED") {
    if (contactChange.status === "PENDING_CONTACT_VERIFICATION") {
      throw new Error("Contact verification is already in progress");
    }

    throw new Error(
      "Contact change must pass liveness verification first",
    );
  }

  const now = new Date();

  if (contactChange.expiresAt <= now) {
    await prisma.contactChange.updateMany({
      where: {
        id: contactChange.id,
        userId: input.userId,
        status: "LIVENESS_VERIFIED",
      },
      data: {
        status: "EXPIRED",
      },
    });

    throw new Error("Contact change has expired");
  }

  const rawToken =
    contactChange.type === "EMAIL"
      ? createEmailVerificationToken()
      : createPhoneVerificationCode();

  const tokenHash = hashContactVerificationToken(rawToken);
  const verificationExpiresAt = getContactVerificationExpiry();

  if (verificationExpiresAt > contactChange.expiresAt) {
    verificationExpiresAt.setTime(contactChange.expiresAt.getTime());
  }

  const updated = await prisma.contactChange.updateMany({
    where: {
      id: contactChange.id,
      userId: input.userId,
      status: "LIVENESS_VERIFIED",
    },
    data: {
      status: "PENDING_CONTACT_VERIFICATION",
      contactVerificationTokenHash: tokenHash,
      contactVerificationExpiresAt: verificationExpiresAt,
      contactVerificationAttempts: 0,
    },
  });

  if (updated.count !== 1) {
    throw new Error(
      "Contact verification could not be started because its state changed",
    );
  }

  try {
    if (contactChange.type === "EMAIL") {
      await sendContactChangeVerificationEmail(
        contactChange.requestedValue,
        rawToken,
        verificationExpiresAt,
      );
    } else {
      await sendSms(
        contactChange.requestedValue,
        `Your TransConet contact-change verification code is ${rawToken}. It expires in 10 minutes. Do not share this code with anyone.`,
      );
    }
  } catch (error) {
    await prisma.contactChange.updateMany({
      where: {
        id: contactChange.id,
        userId: input.userId,
        status: "PENDING_CONTACT_VERIFICATION",
        contactVerificationTokenHash: tokenHash,
      },
      data: {
        status: "LIVENESS_VERIFIED",
        contactVerificationTokenHash: null,
        contactVerificationExpiresAt: null,
        contactVerificationAttempts: 0,
      },
    });

      publishEvent("admin", {
        eventType: "CONTACT_CHANGE_VERIFICATION_FAILED",
        module: "SECURITY_CENTER",
        entityType: "CONTACT_CHANGE",
        entityId: contactChange.id,
        actorId: input.userId,
        data: {
          type: contactChange.type,
          status: "LIVENESS_VERIFIED",
          reason: "CONTACT_VERIFICATION_DELIVERY_FAILED",
        },
      });

    throw error;
  }

    publishEvent("admin", {
      eventType: "CONTACT_CHANGE_VERIFICATION_SENT",
      module: "SECURITY_CENTER",
      entityType: "CONTACT_CHANGE",
      entityId: contactChange.id,
      actorId: input.userId,
      data: {
        type: contactChange.type,
        status: "PENDING_CONTACT_VERIFICATION",
      },
    });

  return {
    contactChangeId: contactChange.id,
    type: contactChange.type,
    status: "PENDING_CONTACT_VERIFICATION" as const,
    expiresAt: verificationExpiresAt,
  };
}

export async function verifyContactChange(input: {
  userId: string;
  contactChangeId: string;
  verificationToken: string;
}) {
  const tokenHash = hashContactVerificationToken(
    input.verificationToken.trim(),
  );

  const now = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const contactChange = await tx.contactChange.findFirst({
        where: {
          id: input.contactChangeId,
          userId: input.userId,
          status: "PENDING_CONTACT_VERIFICATION",
        },
        select: {
          id: true,
          type: true,
          requestedValue: true,
          contactVerificationTokenHash: true,
          contactVerificationExpiresAt: true,
          contactVerificationAttempts: true,
          expiresAt: true,
        },
      });

      if (!contactChange) {
        throw new Error("Contact verification request not found");
      }

      if (
        !contactChange.contactVerificationTokenHash ||
        contactChange.contactVerificationTokenHash !== tokenHash
      ) {
        const failedAttempt = await tx.contactChange.updateMany({
          where: {
            id: contactChange.id,
            userId: input.userId,
            status: "PENDING_CONTACT_VERIFICATION",
            contactVerificationAttempts: {
              lt: MAX_CONTACT_VERIFICATION_ATTEMPTS,
            },
          },
          data: {
            contactVerificationAttempts: {
              increment: 1,
            },
          },
        });

        if (failedAttempt.count !== 1) {
          throw new Error("Contact verification request is no longer active");
        }

        const updatedAttemptState = await tx.contactChange.findUnique({
          where: {
            id: contactChange.id,
          },
          select: {
            contactVerificationAttempts: true,
          },
        });

        if (
          updatedAttemptState &&
          updatedAttemptState.contactVerificationAttempts >=
            MAX_CONTACT_VERIFICATION_ATTEMPTS
        ) {
          await tx.contactChange.updateMany({
            where: {
              id: contactChange.id,
              userId: input.userId,
              status: "PENDING_CONTACT_VERIFICATION",
              contactVerificationAttempts: {
                gte: MAX_CONTACT_VERIFICATION_ATTEMPTS,
              },
            },
            data: {
              status: "FAILED",
              contactVerificationTokenHash: null,
              contactVerificationExpiresAt: null,
            },
          });
        }

          return {
            invalidContactVerification: true as const,
            contactChangeId: contactChange.id,
            type: contactChange.type,
            failed:
              (updatedAttemptState?.contactVerificationAttempts ?? 0) >=
              MAX_CONTACT_VERIFICATION_ATTEMPTS,
          };
      }

      if (
        !contactChange.contactVerificationExpiresAt ||
        contactChange.contactVerificationExpiresAt <= now ||
        contactChange.expiresAt <= now
      ) {
        await tx.contactChange.updateMany({
          where: {
            id: contactChange.id,
            userId: input.userId,
            status: "PENDING_CONTACT_VERIFICATION",
          },
          data: {
            status: "EXPIRED",
            contactVerificationTokenHash: null,
            contactVerificationExpiresAt: null,
          },
        });

        throw new Error("Contact verification token has expired");
      }

      const conflictingUser =
        contactChange.type === "EMAIL"
          ? await tx.user.findFirst({
              where: {
                email: {
                  equals: contactChange.requestedValue,
                  mode: "insensitive",
                },
                NOT: {
                  id: input.userId,
                },
              },
              select: {
                id: true,
              },
            })
          : await tx.user.findFirst({
              where: {
                phone: contactChange.requestedValue,
                NOT: {
                  id: input.userId,
                },
              },
              select: {
                id: true,
              },
            });

      if (conflictingUser) {
        throw new Error(
          `That ${contactChange.type.toLowerCase()} is already in use`,
        );
      }

      const userData =
        contactChange.type === "EMAIL"
          ? {
              email: contactChange.requestedValue,
              emailVerifiedAt: now,
            }
          : {
              phone: contactChange.requestedValue,
              phoneVerifiedAt: now,
            };

      const updatedUser = await tx.user.update({
        where: {
          id: input.userId,
        },
        data: userData,
      });

      const completed = await tx.contactChange.updateMany({
        where: {
          id: contactChange.id,
          userId: input.userId,
          status: "PENDING_CONTACT_VERIFICATION",
          contactVerificationTokenHash: tokenHash,
        },
        data: {
          status: "COMPLETED",
          contactVerifiedAt: now,
          completedAt: now,
          contactVerificationTokenHash: null,
          contactVerificationExpiresAt: null,
          contactVerificationAttempts: 0,
        },
      });

      if (completed.count !== 1) {
        throw new Error(
          "Contact verification could not be completed because its state changed",
        );
      }

      await tx.refreshSession.updateMany({
        where: {
          userId: input.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      return {
        contactChangeId: contactChange.id,
        type: contactChange.type,
        status: "COMPLETED" as const,
        verifiedAt: now,
        user: updatedUser,
      };
      });
    if ("invalidContactVerification" in result) {
      if (result.failed) {
        publishEvent("admin", {
          eventType: "CONTACT_CHANGE_FAILED",
          module: "SECURITY_CENTER",
          entityType: "CONTACT_CHANGE",
          entityId: result.contactChangeId,
          actorId: input.userId,
          data: {
            type: result.type,
            status: "FAILED",
            reason: "MAX_CONTACT_VERIFICATION_ATTEMPTS",
          },
        });
      }

      throw new Error("Invalid contact verification token");
    }

    publishEvent("admin", {
      eventType: "CONTACT_CHANGE_COMPLETED",
      module: "SECURITY_CENTER",
      entityType: "CONTACT_CHANGE",
      entityId: result.contactChangeId,
      actorId: input.userId,
      data: {
        type: result.type,
        status: result.status,
      },
    });

    return result;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      throw new Error(
        `That contact value is already in use`,
      );
    }

    throw error;
  }
}
