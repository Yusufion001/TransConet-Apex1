import { randomUUID } from "node:crypto";
import type { Prisma } from "../../generated/prisma/client.js";

type TransactionClient = Prisma.TransactionClient;

function createBankTransferReference() {
  return `BT-${Date.now()}-${randomUUID()}`;
}

export async function createBankTransferPayment(
  tx: TransactionClient,
  booking: {
    id: string;
    customerId: string;
    fare: Prisma.Decimal;
  },
) {
  const existing = await tx.bankTransferPayment.findUnique({
    where: { bookingId: booking.id },
  });

  if (existing) {
    if (existing.customerId !== booking.customerId) {
      throw new Error("Bank transfer payment ownership mismatch");
    }

    if (existing.amount.toString() !== booking.fare.toString()) {
      throw new Error("Bank transfer amount mismatch");
    }

    return existing;
  }

  const transferReference = createBankTransferReference();

  const payment = await tx.payment.create({
    data: {
      bookingId: booking.id,
      customerId: booking.customerId,
      amount: booking.fare,
      currency: "NGN",
      provider: "BANK_TRANSFER",
      transactionReference: transferReference,
      status: "PENDING",
    },
  });

  try {
    const bankTransfer = await tx.bankTransferPayment.create({
      data: {
        bookingId: booking.id,
        customerId: booking.customerId,
        amount: booking.fare,
        currency: "NGN",
        transferReference,
        status: "PENDING",
      },
    });

    return {
      payment,
      bankTransfer,
    };
  } catch (error) {
    // The surrounding booking transaction will roll back both records.
    throw error;
  }
}
