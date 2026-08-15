import { prisma } from "../config/prisma.js";

export async function getPlatformOverview() {
  const [
    customers,
    transporters,
    administrators,
    vehicles,
    bookings,
    payments,
    notifications,
    supportTickets,
    disputes,
    activeTrips,
    completedTrips,
    pendingBookings,
    pendingPayments,
    pendingVerification,
    totalSystemRevenue,
    availableWalletBalance,
    pendingWalletBalance,
    recentBookings,
    recentPayments,
  ] = await Promise.all([
    prisma.user.count({
      where: { role: "CUSTOMER" },
    }),

    prisma.user.count({
      where: { role: "TRANSPORTER" },
    }),

    prisma.user.count({
      where: { role: "ADMIN" },
    }),

    prisma.vehicle.count(),

    prisma.booking.count(),

    prisma.payment.count(),

    prisma.notification.count(),

    prisma.supportTicket.count(),

    prisma.dispute.count(),

    prisma.booking.count({
      where: {
        status: {
          in: [
            "ACCEPTED",
            "DRIVER_ARRIVING",
            "ARRIVED",
            "IN_TRANSIT",
          ],
        },
      },
    }),

    prisma.booking.count({
      where: {
        status: "COMPLETED",
      },
    }),

    prisma.booking.count({
      where: {
        status: "REQUESTED",
      },
    }),

    prisma.payment.count({
      where: {
        status: "PENDING",
      },
    }),

    prisma.document.count({
      where: {
        status: "PENDING",
      },
    }),

    prisma.payment.aggregate({
      where: {
        status: "SUCCESS",
      },
      _sum: {
        amount: true,
      },
    }),

    prisma.wallet.aggregate({
      _sum: {
        availableBalance: true,
      },
    }),

    prisma.wallet.aggregate({
      _sum: {
        pendingBalance: true,
      },
    }),

    prisma.booking.findMany({
      take: 10,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        customerId: true,
        transporterId: true,
        vehicleId: true,
        pickupLocation: true,
        destination: true,
        status: true,
        fare: true,
        paymentStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    }),

    prisma.payment.findMany({
      take: 10,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        bookingId: true,
        customerId: true,
        amount: true,
        currency: true,
        provider: true,
        transactionReference: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    customers,
    transporters,
    administrators,
    vehicles,
    bookings,
    payments,
    notifications,
    supportTickets,
    disputes,

    activeTrips,
    completedTrips,
    pendingBookings,
    pendingPayments,
    pendingVerification,

    totalSystemRevenue:
      totalSystemRevenue._sum.amount ?? 0,

    availableWalletBalance:
      availableWalletBalance._sum.availableBalance ?? 0,

    pendingWalletBalance:
      pendingWalletBalance._sum.pendingBalance ?? 0,

    recentBookings,
    recentPayments,

    synchronizedAt: new Date(),
  };
}
