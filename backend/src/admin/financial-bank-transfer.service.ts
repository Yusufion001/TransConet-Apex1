import { prisma } from "../config/prisma.js";
import { completePayment } from "../payments/payment.service.js";
import { publishAdminEvent } from "../realtime/realtime.service.js";

export async function verifyBankTransfer(
  bankTransferId: string,
  administratorId: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const transfer = await tx.bankTransferPayment.findUnique({
      where: { id: bankTransferId },
      include: {
        booking: true,
        customer: true,
      },
    });

    if (!transfer) {
      throw new Error("Bank transfer payment not found");
    }

    if (transfer.status !== "PENDING") {
      throw new Error("Bank transfer is no longer pending verification");
    }

    if (transfer.booking.paymentMethod !== "BANK_TRANSFER") {
      throw new Error("Booking is not configured for bank transfer");
    }

    if (transfer.booking.customerId !== transfer.customerId) {
      throw new Error("Bank transfer ownership mismatch");
    }

    const updated = await tx.bankTransferPayment.updateMany({
      where: {
        id: bankTransferId,
        status: "PENDING",
      },
      data: {
        status: "VERIFIED",
        verifiedAt: new Date(),
        verifiedBy: administratorId,
        rejectionReason: null,
      },
    });

    if (updated.count !== 1) {
      throw new Error("Bank transfer verification state changed; retry");
    }

    await tx.auditLog.create({
      data: {
        administratorId,
        affectedUserId: transfer.customerId,
        affectedBookingId: transfer.bookingId,
        action: "BANK_TRANSFER_VERIFIED",
        previousValue: {
          bankTransferId: transfer.id,
          status: transfer.status,
          amount: transfer.amount.toString(),
          transferReference: transfer.transferReference,
        },
        newValue: {
          bankTransferId: transfer.id,
          status: "VERIFIED",
          amount: transfer.amount.toString(),
          transferReference: transfer.transferReference,
          verifiedBy: administratorId,
        },
      },
    });

    return updated;
  });

  if (result.count !== 1) {
    throw new Error("Bank transfer verification failed");
  }

  const transfer = await prisma.bankTransferPayment.findUnique({
    where: { id: bankTransferId },
  });

  if (!transfer) {
    throw new Error("Verified bank transfer could not be reloaded");
  }

  const payment = await prisma.payment.findUnique({
    where: {
      transactionReference: transfer.transferReference,
    },
  });

  if (!payment) {
    throw new Error("Associated payment record not found");
  }

  const completion = await completePayment(payment.id);

  publishAdminEvent({
    eventType: "BANK_TRANSFER_VERIFIED",
    module: "FINANCIAL_OPERATIONS",
    entityId: transfer.bookingId,
    actorId: administratorId,
    data: {
      bankTransferId: transfer.id,
      paymentId: payment.id,
      bookingId: transfer.bookingId,
      amount: transfer.amount.toString(),
      currency: transfer.currency,
      transferReference: transfer.transferReference,
    },
  });

  return {
    bankTransfer: transfer,
    payment: payment,
  };
}
