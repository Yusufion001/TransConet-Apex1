function date(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function userSummary(user: any) {
  if (!user) return null;

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    ...(user.phone !== undefined ? { phone: user.phone } : {}),
  };
}

export function toSupportTicketDto(ticket: any) {
  return {
    id: ticket.id,
    requesterId: ticket.requesterId,
    bookingId: ticket.bookingId,
    category: ticket.category,
    subject: ticket.subject,
    description: ticket.description,
    priority: ticket.priority,
    status: ticket.status,
    assignedAdminId: ticket.assignedAdminId,
    createdAt: date(ticket.createdAt),
    updatedAt: date(ticket.updatedAt),

    ...(ticket.requester !== undefined
      ? { requester: userSummary(ticket.requester) }
      : {}),

    ...(ticket.assignedAdmin !== undefined
      ? { assignedAdmin: userSummary(ticket.assignedAdmin) }
      : {}),

    ...(ticket.booking !== undefined
      ? {
          booking: ticket.booking
            ? {
                id: ticket.booking.id,
                status: ticket.booking.status,
              }
            : null,
        }
      : {}),
  };
}
