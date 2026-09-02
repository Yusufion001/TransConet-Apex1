import type { Prisma } from "../../../generated/prisma/client.js";

type PaymentRecord = {
  id: string;
  bookingId: string;
  customerId: string;
  amount: Prisma.Decimal;
  currency: string;
  provider: string;
  transactionReference: string;
  checkoutUrl: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PaymentDto = {
  id: string;
  bookingId: string;
  amount: string;
  currency: string;
  provider: string;
  transactionReference: string;
  checkoutUrl: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export function toPaymentDto(payment: PaymentRecord): PaymentDto {
  return {
    id: payment.id,
    bookingId: payment.bookingId,
    amount: payment.amount.toString(),
    currency: payment.currency,
    provider: payment.provider,
    transactionReference: payment.transactionReference,
    checkoutUrl: payment.checkoutUrl,
    status: payment.status,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}
