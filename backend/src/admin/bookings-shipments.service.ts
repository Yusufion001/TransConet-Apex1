import { prisma } from "../config/prisma.js";
import { toBookingDto } from "../bookings/booking.dto.js";
import {
  assignBooking,
  updateBookingStatus,
} from "../bookings/booking.service.js";
import { getBookingEvents } from "../events/event.service.js";

const relatedInclude = {
  customer: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      status: true,
    },
  },
  transporter: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      status: true,
      transporterTier: true,
    },
  },
  vehicle: {
    select: {
      id: true,
      registrationNumber: true,
      vehicleType: true,
      vehicleClass: true,
      availabilityStatus: true,
      verificationStatus: true,
    },
  },
};

export async function listAdminBookings(input: {
  search?: string;
  status?: string;
  paymentStatus?: string;
  page: number;
  limit: number;
}) {
  const search = input.search?.trim();
  const where: any = {};

  if (input.status) {
    where.status = input.status;
  }

  if (input.paymentStatus) {
    where.paymentStatus = input.paymentStatus;
  }

  if (search) {
    where.OR = [
      { id: { contains: search } },
      { pickupLocation: { contains: search } },
      { destination: { contains: search } },

      {
        customer: {
          is: { firstName: { contains: search } },
        },
      },
      {
        customer: {
          is: { lastName: { contains: search } },
        },
      },
      {
        customer: {
          is: { email: { contains: search } },
        },
      },
      {
        customer: {
          is: { phone: { contains: search } },
        },
      },

      {
        transporter: {
          is: { firstName: { contains: search } },
        },
      },
      {
        transporter: {
          is: { lastName: { contains: search } },
        },
      },
      {
        transporter: {
          is: { email: { contains: search } },
        },
      },

      {
        vehicle: {
          is: { registrationNumber: { contains: search } },
        },
      },
    ];
  }

  const skip = (input.page - 1) * input.limit;

  const [total, bookings] = await Promise.all([
    prisma.booking.count({ where }),

    prisma.booking.findMany({
      where,
      skip,
      take: input.limit,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        ...relatedInclude,

        _count: {
          select: {
            events: true,
            payments: true,
            disputes: true,
            supportTickets: true,
          },
        },
      },
    }),
  ]);

  return {
    items: bookings.map((booking) => ({
      ...toBookingDto(booking),
      customer: booking.customer,
      transporter: booking.transporter,
      vehicle: booking.vehicle,
      counts: booking._count,
    })),

    page: input.page,
    limit: input.limit,
    total,
    totalPages: Math.ceil(total / input.limit),
  };
}

export async function getAdminBooking(id: string) {
  const booking = await prisma.booking.findUnique({
    where: { id },

    include: {
      ...relatedInclude,

      payments: {
        select: {
          id: true,
          amount: true,
          currency: true,
          provider: true,
          transactionReference: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },

      disputes: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },

      supportTickets: {
        select: {
          id: true,
          status: true,
          priority: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!booking) {
    return null;
  }

  const events = await getBookingEvents(id);

  return {
    ...toBookingDto(booking),

    customer: booking.customer,
    transporter: booking.transporter,
    vehicle: booking.vehicle,

    payments: booking.payments.map((payment) => ({
      ...payment,
      amount: payment.amount.toString(),
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    })),

    disputes: booking.disputes,
    supportTickets: booking.supportTickets,
    events,
  };
}

export async function adminUpdateBookingStatus(
  id: string,
  status: any,
) {
  return updateBookingStatus(id, status);
}

export async function adminAssignBooking(
  id: string,
  transporterId: string,
  vehicleId: string,
) {
  return assignBooking(
    id,
    transporterId,
    vehicleId,
  );
}
