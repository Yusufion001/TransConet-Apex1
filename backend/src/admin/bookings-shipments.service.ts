import { prisma } from "../config/prisma.js";
import { toBookingDto } from "../bookings/booking.dto.js";
import {
  assignBooking,
  updateBookingStatus,
} from "../bookings/booking.service.js";
import { getBookingEvents } from "../events/event.service.js";
import { supabaseStorageService } from "../storage/supabase-storage.service.js";

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
  expressBooking: {
    select: {
      id: true,
      bookingId: true,
      status: true,
      dispatchStage: true,
      generalBoardPublishedAt: true,
      packagingType: true,
      packageCount: true,
      weightKg: true,
      volumeCbm: true,
      chargeableRevenueTons: true,
      distanceKm: true,
      baseCharge: true,
      distanceCharge: true,
      revenueTonCharge: true,
      packagingCharge: true,
      fare: true,
      currency: true,
      kgPerMetricTon: true,
      volumeCbmPerPackage: true,
      distanceRatePerKm: true,
      revenueTonRate: true,
      minimumChargeableRevenueTons: true,
      maxCargoWeightKg: true,
      pickupOtpExpiresAt: true,
      pickupVerifiedAt: true,
      createdAt: true,
      updatedAt: true,
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
      expressBooking: booking.expressBooking
        ? {
            ...booking.expressBooking,
            weightKg: booking.expressBooking.weightKg.toString(),
            volumeCbm: booking.expressBooking.volumeCbm.toString(),
            chargeableRevenueTons:
              booking.expressBooking.chargeableRevenueTons.toString(),
            distanceKm: booking.expressBooking.distanceKm.toString(),
            baseCharge: booking.expressBooking.baseCharge.toString(),
            distanceCharge: booking.expressBooking.distanceCharge.toString(),
            revenueTonCharge:
              booking.expressBooking.revenueTonCharge.toString(),
            packagingCharge: booking.expressBooking.packagingCharge.toString(),
            fare: booking.expressBooking.fare.toString(),
            kgPerMetricTon:
              booking.expressBooking.kgPerMetricTon.toString(),
            volumeCbmPerPackage:
              booking.expressBooking.volumeCbmPerPackage.toString(),
            distanceRatePerKm:
              booking.expressBooking.distanceRatePerKm.toString(),
            revenueTonRate:
              booking.expressBooking.revenueTonRate.toString(),
            minimumChargeableRevenueTons:
              booking.expressBooking.minimumChargeableRevenueTons.toString(),
            maxCargoWeightKg:
              booking.expressBooking.maxCargoWeightKg.toString(),
            generalBoardPublishedAt:
              booking.expressBooking.generalBoardPublishedAt?.toISOString() ??
              null,
            pickupOtpExpiresAt:
              booking.expressBooking.pickupOtpExpiresAt?.toISOString() ??
              null,
            pickupVerifiedAt:
              booking.expressBooking.pickupVerifiedAt?.toISOString() ?? null,
            createdAt: booking.expressBooking.createdAt.toISOString(),
            updatedAt: booking.expressBooking.updatedAt.toISOString(),
          }
        : null,
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

  const cargoPhotoUrl = booking.cargoPhotoPath
    ? (await supabaseStorageService.createSignedDownloadUrl(
        booking.cargoPhotoPath,
        600,
      )).signedUrl
    : null;

  const receiverSignatureUrl = booking.receiverSignaturePath
    ? (await supabaseStorageService.createSignedDownloadUrl(
        booking.receiverSignaturePath,
        600,
      )).signedUrl
    : null;

  return {
    ...toBookingDto(booking),
    cargoPhotoUrl,
    receiverSignatureUrl,

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


export async function getBookingAssignmentOptions() {
  const transporters = await prisma.user.findMany({
    where: {
      role: "TRANSPORTER",
      status: "ACTIVE",
      transporterProfile: {
        isNot: null,
      },
    },
    orderBy: [
      { firstName: "asc" },
      { lastName: "asc" },
    ],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      status: true,
      transporterTier: true,
      vehicles: {
        where: {
          verificationStatus: "APPROVED",
          availabilityStatus: "AVAILABLE",
        },
        orderBy: {
          registrationNumber: "asc",
        },
        select: {
          id: true,
          registrationNumber: true,
          vehicleType: true,
          vehicleClass: true,
          availabilityStatus: true,
          verificationStatus: true,
        },
      },
    },
  });

  return transporters.map((transporter) => ({
    id: transporter.id,
    firstName: transporter.firstName,
    lastName: transporter.lastName,
    email: transporter.email,
    phone: transporter.phone,
    status: transporter.status,
    transporterTier: transporter.transporterTier,
    vehicles: transporter.vehicles,
  }));
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
