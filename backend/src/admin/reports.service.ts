import { prisma } from "../config/prisma.js";
import { publishAdminEvent } from "../realtime/realtime.service.js";

export async function getAdminReportsOverview() {
  const [
    users,
    customers,
    transporters,
    administrators,
    vehicles,
    bookings,
    completedBookings,
    cancelledBookings,
    payments,
    successfulPayments,
    failedPayments,
    withdrawals,
    documents,
    supportTickets,
    disputes,
    messages,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.user.count({ where: { role: "TRANSPORTER" } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.vehicle.count(),
    prisma.booking.count(),
    prisma.booking.count({ where: { status: "COMPLETED" } }),
    prisma.booking.count({ where: { status: "CANCELLED" } }),
    prisma.payment.count(),
    prisma.payment.count({ where: { status: "SUCCESS" } }),
    prisma.payment.count({ where: { status: "FAILED" } }),
    prisma.withdrawal.count(),
    prisma.document.count(),
    prisma.supportTicket.count(),
    prisma.dispute.count(),
    prisma.message.count(),
  ]);

  return {
    generatedAt: new Date(),
    platform: {
      users,
      customers,
      transporters,
      administrators,
      vehicles,
    },
    operations: {
      bookings,
      completedBookings,
      cancelledBookings,
      completionRate:
        bookings > 0
          ? Number(((completedBookings / bookings) * 100).toFixed(2))
          : 0,
    },
    financial: {
      payments,
      successfulPayments,
      failedPayments,
      withdrawals,
    },
    compliance: {
      documents,
      supportTickets,
      disputes,
    },
    communication: {
      messages,
    },
  };
}

export async function publishReportGeneratedEvent(
  administratorId: string,
) {
  const reportId = crypto.randomUUID();

  publishAdminEvent({
    eventType: "REPORT_GENERATED",
    module: "REPORTS_CENTER",
    entityType: "REPORT",
    entityId: reportId,
    actorId: administratorId,
    data: {
      reportId,
      generatedAt: new Date(),
    },
  });

  return {
    id: reportId,
    status: "GENERATED",
    generatedAt: new Date(),
  };
}
