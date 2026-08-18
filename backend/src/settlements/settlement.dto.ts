function date(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function decimal(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function userSummary(user: any) {
  if (!user) return null;

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    ...(user.email !== undefined ? { email: user.email } : {}),
    ...(user.phone !== undefined ? { phone: user.phone } : {}),
    ...(user.transporterTier !== undefined
      ? { transporterTier: user.transporterTier }
      : {}),
  };
}

function bookingSummary(booking: any) {
  if (!booking) return null;

  return {
    id: booking.id,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    fare: decimal(booking.fare),
    pickupLocation: booking.pickupLocation,
    destination: booking.destination,
  };
}

function paymentSummary(payment: any) {
  if (!payment) return null;

  return {
    id: payment.id,
    amount: decimal(payment.amount),
    currency: payment.currency,
    provider: payment.provider,
    status: payment.status,
    createdAt: date(payment.createdAt),
  };
}

function commissionRuleSummary(rule: any) {
  if (!rule) return null;

  return {
    id: rule.id,
    name: rule.name,
    type: rule.type,
    rate: decimal(rule.rate),
    currency: rule.currency,
    status: rule.status,
  };
}

function approvalSummary(approval: any) {
  return {
    id: approval.id,
    administratorId: approval.administratorId,
    status: approval.status,
    decisionNote: approval.decisionNote,
    createdAt: date(approval.createdAt),
    decidedAt: date(approval.decidedAt),
    ...(approval.administrator !== undefined
      ? {
          administrator: userSummary(approval.administrator),
        }
      : {}),
  };
}

export function toSettlementDto(settlement: any) {
  return {
    id: settlement.id,
    bookingId: settlement.bookingId,
    paymentId: settlement.paymentId,
    transporterId: settlement.transporterId,
    commissionRuleId: settlement.commissionRuleId,

    grossAmount: decimal(settlement.grossAmount),
    commissionAmount: decimal(settlement.commissionAmount),
    netAmount: decimal(settlement.netAmount),
    currency: settlement.currency,
    status: settlement.status,

    requestedAt: date(settlement.requestedAt),
    approvedAt: date(settlement.approvedAt),
    releasedAt: date(settlement.releasedAt),
    rejectedAt: date(settlement.rejectedAt),
    rejectionReason: settlement.rejectionReason,
    approvedBy: settlement.approvedBy,
    releasedBy: settlement.releasedBy,
    createdAt: date(settlement.createdAt),
    updatedAt: date(settlement.updatedAt),

    ...(settlement.booking !== undefined
      ? { booking: bookingSummary(settlement.booking) }
      : {}),

    ...(settlement.payment !== undefined
      ? { payment: paymentSummary(settlement.payment) }
      : {}),

    ...(settlement.transporter !== undefined
      ? { transporter: userSummary(settlement.transporter) }
      : {}),

    ...(settlement.commissionRule !== undefined
      ? {
          commissionRule: commissionRuleSummary(
            settlement.commissionRule,
          ),
        }
      : {}),

    ...(settlement.approvals !== undefined
      ? {
          approvals: settlement.approvals.map(approvalSummary),
        }
      : {}),
  };
}

export function toSettlementDecisionDto(result: any) {
  return {
    approval: result.approval
      ? approvalSummary(result.approval)
      : null,
    settlement: result.settlement
      ? toSettlementDto(result.settlement)
      : null,
  };
}
