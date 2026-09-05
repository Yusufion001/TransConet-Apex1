import crypto from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { publishEvent } from "../../realtime/event-bus.js";
import type { InputJsonValue } from "../../../generated/prisma/internal/prismaNamespace.js";
import { youverifyWebhookSchema } from "./youverify.validators.js";

const PROVIDER = "YOUVERIFY";

function verifySignature(
  rawBody: Buffer,
  signature: string,
): boolean {
  const expected = crypto
    .createHmac("sha256", env.YOUVERIFY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  const received = signature.trim().toLowerCase();

  if (!/^[a-f0-9]{64}$/.test(received)) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(expected, "utf8"),
    Buffer.from(received, "utf8"),
  );
}

function getRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function extractVerificationId(
  payload: Record<string, unknown>,
): string | undefined {
  const data = getRecord(payload.data);

  if (!data) {
    return undefined;
  }

  const directId =
    data.id ??
    data.referenceId ??
    data.reference_id;

  if (
    typeof directId === "string" &&
    directId.trim()
  ) {
    return directId.trim();
  }

  const report = getRecord(data.report);

  if (report) {
    const reportId =
      report.id ??
      report.referenceId ??
      report.reference_id;

    if (
      typeof reportId === "string" &&
      reportId.trim()
    ) {
      return reportId.trim();
    }
  }

  return undefined;
}

function extractStatus(
  payload: Record<string, unknown>,
): string | undefined {
  const data = getRecord(payload.data);

  if (!data) {
    return undefined;
  }

  const directStatus =
    data.status ??
    data.taskStatus ??
    data.task_status;

  if (
    typeof directStatus === "string" &&
    directStatus.trim()
  ) {
    return directStatus.trim().toUpperCase();
  }

  const report = getRecord(data.report);

  if (report) {
    const reportStatus =
      report.status ??
      report.taskStatus ??
      report.task_status;

    if (
      typeof reportStatus === "string" &&
      reportStatus.trim()
    ) {
      return reportStatus.trim().toUpperCase();
    }
  }

  return undefined;
}

function extractEventId(
  payload: Record<string, unknown>,
  rawBody: Buffer,
): string {
  const candidates = [
    payload.id,
    payload.eventId,
    payload.event_id,
    payload.referenceId,
    payload.reference_id,
  ];

  for (const candidate of candidates) {
    if (
      typeof candidate === "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  /*
   * Some provider payloads do not expose a stable event ID.
   *
   * A SHA-256 digest of the authenticated raw payload gives us
   * deterministic idempotency for identical webhook deliveries.
   */
  return crypto
    .createHash("sha256")
    .update(rawBody)
    .digest("hex");
}

function extractEventType(
  payload: Record<string, unknown>,
): string {
  const candidates = [
    payload.event,
    payload.eventType,
    payload.event_type,
    payload.type,
  ];

  for (const candidate of candidates) {
    if (
      typeof candidate === "string" &&
      candidate.trim()
    ) {
      return candidate.trim().toUpperCase();
    }
  }

  return "VERIFICATION_WEBHOOK";
}

function isVerificationSuccess(status: string): boolean {
  return [
    "VERIFIED",
    "FOUND",
    "COMPLETED",
    "SUCCESS",
  ].includes(status);
}

function isVerificationFailure(status: string): boolean {
  return [
    "FAILED",
    "REJECTED",
    "NOT_FOUND",
  ].includes(status);
}

function isPrismaUniqueConstraintError(
  error: unknown,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function processYouverifyWebhook(
  rawBody: Buffer,
  signature: string,
) {
  if (!verifySignature(rawBody, signature)) {
    throw new Error("Invalid Youverify webhook signature");
  }

  let parsedPayload: unknown;

  try {
    parsedPayload = JSON.parse(
      rawBody.toString("utf8"),
    );
  } catch {
    throw new Error("Invalid Youverify webhook JSON");
  }

  const validation =
    youverifyWebhookSchema.safeParse(parsedPayload);

  if (!validation.success) {
    throw new Error("Invalid Youverify webhook payload");
  }

  const payload =
    validation.data as Record<string, unknown>;

  const providerEventId =
    extractEventId(payload, rawBody);

  const eventType =
    extractEventType(payload);

  /*
   * First lookup is an optimization.
   * The database unique constraint remains the final
   * protection against concurrent duplicate deliveries.
   */
  const existing =
    await prisma.youverifyWebhookEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: PROVIDER,
          providerEventId,
        },
      },
    });

  if (existing) {
    return {
      duplicate: true,
      processed: existing.processed,
      webhookEventId: existing.id,
    };
  }

  const verificationId =
    extractVerificationId(payload);

  if (!verificationId) {
    throw new Error(
      "Youverify webhook does not contain a verification ID",
    );
  }

  const status =
    extractStatus(payload) ?? "UNKNOWN";

  /*
   * Find the TransConet document associated with
   * the provider verification.
   */
  const document =
    await prisma.document.findFirst({
      where: {
        externalVerificationId: verificationId,
        verificationProvider: PROVIDER,
      },
    });

  const verification =
    await prisma.verification.findFirst({
      where: {
        externalVerificationId: verificationId,
        verificationProvider: PROVIDER,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

  let webhookEvent;

  try {
    webhookEvent =
      await prisma.youverifyWebhookEvent.create({
        data: {
          id: crypto.randomUUID(),
          provider: PROVIDER,
          providerEventId,
          eventType,
          documentId: document?.id,
          verificationId: verification?.id,
          payload: payload as InputJsonValue,
        },
      });
  } catch (error) {
    /*
     * Another request may have inserted this event
     * between our lookup and create.
     */
    if (isPrismaUniqueConstraintError(error)) {
      const concurrentEvent =
        await prisma.youverifyWebhookEvent.findUnique({
          where: {
            provider_providerEventId: {
              provider: PROVIDER,
              providerEventId,
            },
          },
        });

      if (concurrentEvent) {
        return {
          duplicate: true,
          processed: concurrentEvent.processed,
          webhookEventId: concurrentEvent.id,
        };
      }
    }

    throw error;
  }

  /*
   * An authenticated event with no matching TransConet verification
   * record is retained for administrative investigation, but must
   * not modify any business record.
   */
  if (!document && !verification) {
    return {
      handled: false,
      duplicate: false,
      reason: "Verification record not found",
      verificationId,
      webhookEventId: webhookEvent.id,
    };
  }

  try {
    /*
     * New number-based transporter verification records are handled
     * separately from legacy Document verification.
     *
     * Youverify success/failure updates only provider state.
     * Administrative approval/rejection remains a separate decision.
     */
    if (verification) {
      const verificationUpdate: {
        providerResponse: InputJsonValue;
        providerStatus?: "SUCCESS" | "FAILED" | "PENDING";
        verifiedAt?: Date | null;
      } = {
        providerResponse: payload as InputJsonValue,
      };

      if (isVerificationSuccess(status)) {
        verificationUpdate.providerStatus = "SUCCESS";
        verificationUpdate.verifiedAt =
          verification.verifiedAt ?? new Date();
      } else if (isVerificationFailure(status)) {
        verificationUpdate.providerStatus = "FAILED";
      } else {
        verificationUpdate.providerStatus = "PENDING";
      }

      const updatedVerification =
        await prisma.verification.update({
          where: {
            id: verification.id,
          },
          data: verificationUpdate,
        });

      publishEvent("admin", {
        eventType: isVerificationSuccess(status)
          ? "VERIFICATION_COMPLETED"
          : isVerificationFailure(status)
            ? "VERIFICATION_FAILED"
            : "VERIFICATION_UPDATED",
        module: "VERIFICATION_CENTER",
        entityType: "VERIFICATION",
        entityId: updatedVerification.id,
        data: updatedVerification,
      });

      const processedEvent =
        await prisma.youverifyWebhookEvent.update({
          where: {
            id: webhookEvent.id,
          },
          data: {
            processed: true,
            processedAt: new Date(),
          },
        });

      return {
        handled: true,
        duplicate: false,
        processed: processedEvent.processed,
        webhookEventId: processedEvent.id,
        verificationId,
        status,
        verification: updatedVerification,
      };
    }

    /*
     * Legacy document-based verification flow.
     * Provider success does NOT approve the document.
     * Administrative approval remains a separate operation.
     */
    if (!document) {
      throw new Error("Document verification record not found");
    }

    let updatedDocument = document;


    if (isVerificationSuccess(status)) {
      updatedDocument =
        await prisma.document.update({
          where: {
            id: document.id,
          },
          data: {
            providerResponse:
              payload as InputJsonValue,
            verifiedAt:
              document.verifiedAt ?? new Date(),

            /*
             * Do not change:
             * status
             * adminApproved
             * adminApprovedAt
             * reviewedBy
             */
          },
        });

      publishEvent("admin", {
        eventType: "VERIFICATION_COMPLETED",
        module: "VERIFICATION_CENTER",
        entityType: "DOCUMENT",
        entityId: updatedDocument.id,
        data: updatedDocument,
      });
    } else if (isVerificationFailure(status)) {
      /*
       * Provider failure means the external verification failed.
       * We only move the document to REJECTED if an administrator
       * has not already made an approval decision.
       */
      if (!document.adminApproved) {
        updatedDocument =
          await prisma.document.update({
            where: {
              id: document.id,
            },
            data: {
              providerResponse:
                payload as InputJsonValue,
              status: "REJECTED",
              adminApproved: false,
              adminApprovedAt: null,
            },
          });
      } else {
        updatedDocument =
          await prisma.document.update({
            where: {
              id: document.id,
            },
            data: {
              providerResponse:
                payload as InputJsonValue,
            },
          });
      }

      publishEvent("admin", {
        eventType: "VERIFICATION_FAILED",
        module: "VERIFICATION_CENTER",
        entityType: "DOCUMENT",
        entityId: updatedDocument.id,
        data: updatedDocument,
      });
    } else {
      /*
       * Unknown provider statuses are recorded but do not
       * change the business state of the document.
       */
      updatedDocument =
        await prisma.document.update({
          where: {
            id: document.id,
          },
          data: {
            providerResponse:
              payload as InputJsonValue,
          },
        });
    }

    const processedEvent =
      await prisma.youverifyWebhookEvent.update({
        where: {
          id: webhookEvent.id,
        },
        data: {
          processed: true,
          processedAt: new Date(),
        },
      });

    return {
      handled: true,
      duplicate: false,
      processed: processedEvent.processed,
      webhookEventId: processedEvent.id,
      verificationId,
      status,
      document: updatedDocument,
    };
  } catch (error) {
    /*
     * Keep the webhook event unprocessed when business processing
     * fails. This gives the administration platform a durable
     * record for inspection and future retry tooling.
     */
    console.error(
      `Youverify webhook processing failed: ${providerEventId}`,
      error,
    );

    throw error;
  }
}
