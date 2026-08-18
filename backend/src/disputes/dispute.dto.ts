function date(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function toDisputeDto(dispute: any) {
  return {
    id: dispute.id,
    bookingId: dispute.bookingId,
    customerId: dispute.customerId,
    transporterId: dispute.transporterId,
    reason: dispute.reason,
    status: dispute.status,
    createdAt: date(dispute.createdAt),
    updatedAt: date(dispute.updatedAt),
  };
}
