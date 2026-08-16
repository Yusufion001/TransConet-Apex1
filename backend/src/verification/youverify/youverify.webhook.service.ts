import crypto from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { publishEvent } from "../../realtime/event-bus.js";
import type { InputJsonValue } from "../../../generated/prisma/internal/prismaNamespace.js";

function verifySignature(
  rawBody: Buffer,
  signature: string,
): boolean {
  const expected = crypto
    .createHmac("sha256", env.YOUVERIFY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  const received = signature.trim();

  if (expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(received),
  );
}

function extractVerificationId(
  payload: Record<string, unknown>,
): string | undefined {
  const data = payload.data;

  if (!data || typeof data !== "object") {
    return undefined;
  }

  const record = data as Record<string, unknown>;

  const directId =
    record.id ??
    record.referenceId ??
    record.reference_id;

  if (typeof directId === "string") {
    return directId;
  }

  const report = record.report;

  if (report && typeof report === "object") {
    const reportRecord =
      report as Record<string, unknown>;

    const reportId =
      reportRecord.id ??
      reportRecord.reference_id;

    if (typeof reportId === "string") {
      return reportId;
    }
  }

  return undefined;
}

function extractStatus(
  payload: Record<string, unknown>,
): string | undefined {
  const data = payload.data;

  if (!data || typeof data !== "object") {
    return undefined;
  }

  const record = data as Record<string, unknown>;

  const directStatus =
    record.status ??
    record.taskStatus ??
    record.task_status;

  if (typeof directStatus === "string") {
    return directStatus.toUpperCase();
  }

  const report = record.report;

  if (report && typeof report === "object") {
    const reportRecord =
      report as Record<string, unknown>;

    const reportStatus =
      reportRecord.status ??
      reportRecord.taskStatus ??
      reportRecord.task_status;

    if (typeof reportStatus === "string") {
      return reportStatus.toUpperCase();
    }
  }

  return undefined;
}

export async function processYouverifyWebhook(
  rawBody: Buffer,
  signature: string,
) {
  if (!verifySignature(rawBody, signature)) {
    throw new Error("Invalid Youverify webhook signature");
  }

  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(
      rawBody.toString("utf8"),
    ) as Record<string, unknown>;
  } catch {
    throw new Error("Invalid Youverify webhook JSON");
  }

  const verificationId =
    extractVerificationId(payload);

  if (!verificationId) {
    throw new Error(
      "Youverify webhook does not contain a verification ID",
    );
  }

  const status = extractStatus(payload);

  /*
   * We use the provider's verification ID as the
   * externalVerificationId stored on the document.
   */
  const document =
    await prisma.document.findFirst({
      where: {
        externalVerificationId: verificationId,
      },
    });

  if (!document) {
    /*
     * Do not fail the webhook permanently merely because
     * the document is not currently known to TransConet.
     *
     * The event is authenticated, but there is no safe
     * document to update.
     */
    return {
      handled: false,
      reason: "Document not found",
      verificationId,
    };
  }

  const normalizedStatus =
    status ?? "UNKNOWN";

  let documentStatus = document.status;

  if (
    normalizedStatus === "VERIFIED" ||
    normalizedStatus === "FOUND" ||
    normalizedStatus === "COMPLETED" ||
    normalizedStatus === "SUCCESS"
  ) {
    documentStatus = "PENDING";
  }

  if (
    normalizedStatus === "FAILED" ||
    normalizedStatus === "REJECTED" ||
    normalizedStatus === "NOT_FOUND"
  ) {
    documentStatus = "REJECTED";
  }

  const updated =
    await prisma.document.update({
      where: {
        id: document.id,
      },
      data: {
        providerResponse: payload as InputJsonValue,
        status: documentStatus,
        verifiedAt:
          normalizedStatus === "VERIFIED" ||
          normalizedStatus === "FOUND" ||
          normalizedStatus === "COMPLETED" ||
          normalizedStatus === "SUCCESS"
            ? new Date()
            : document.verifiedAt,
      },
    });

  publishEvent("admin", {
    eventType:
      documentStatus === "REJECTED"
        ? "VERIFICATION_FAILED"
        : "VERIFICATION_COMPLETED",
    module: "VERIFICATION_CENTER",
    entityType: "DOCUMENT",
    entityId: updated.id,
    data: updated,
  });

  return {
    handled: true,
    verificationId,
    status: normalizedStatus,
    document: updated,
  };
}
