export type FinancialPaymentSummary = {
  id: string;
  amount: string;
  currency: string;
  provider: string;
  status: string;
};

export type PaymentWebhookEventDto = {
  paymentId: string | null;
  provider: string;
  providerEventId: string;
  eventType: string;
  processed: boolean;
  processedAt: string | null;
  createdAt: string;
  payment: FinancialPaymentSummary | null;
};

export function toPaymentWebhookEventDto(event: {
  paymentId: string | null;
  provider: string;
  providerEventId: string;
  eventType: string;
  processed: boolean;
  processedAt: Date | null;
  createdAt: Date;
  payment?: {
    id: string;
    amount: unknown;
    currency: string;
    provider: string;
    status: string;
  } | null;
}): PaymentWebhookEventDto {
  return {
    paymentId: event.paymentId,
    provider: event.provider,
    providerEventId: event.providerEventId,
    eventType: event.eventType,
    processed: event.processed,
    processedAt: event.processedAt?.toISOString() ?? null,
    createdAt: event.createdAt.toISOString(),
    payment: event.payment
      ? {
          id: event.payment.id,
          amount: String(event.payment.amount),
          currency: event.payment.currency,
          provider: event.payment.provider,
          status: event.payment.status,
        }
      : null,
  };
}
