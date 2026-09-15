import crypto from "node:crypto";
import { prisma } from "../config/prisma.js";
import { getExpressPricingConfig } from "./express-pricing.service.js";
import { sendExpressDeliveryOtp } from "../services/communication.service.js";
import { createSettlementInTransaction } from "../settlements/settlement.service.js";
import { createShipmentEvent } from "../events/event.service.js";
import { publishEvent } from "../realtime/event-bus.js";

const OTP_LENGTH = 6;

function generateOtp(): string {
  return crypto
    .randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, "0");
}

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export async function prepareExpressDeliveryVerification(
  expressBookingId: string,
  customerId: string,
) {
  const expressBooking = await prisma.expressBooking.findUnique({
    where: { id: expressBookingId },
    include: {
      booking: {
        select: {
          id: true,
          customerId: true,
          transporterId: true,
          vehicleId: true,
          status: true,
          paymentStatus: true,
          customer: {
            select: {
              firstName: true,
              email: true,
              phone: true,
            },
          },
        },
      },
    },
  });

  if (!expressBooking) {
    throw new Error("Express booking not found");
  }

  if (expressBooking.booking.customerId !== customerId) {
    throw new Error("You do not have access to this Express booking");
  }

  if (expressBooking.status !== "ACTIVE") {
    throw new Error(
      "Express booking must be ACTIVE before delivery verification",
    );
  }

  if (!expressBooking.booking.transporterId) {
    throw new Error("No transporter assigned");
  }

  if (expressBooking.booking.paymentStatus !== "SUCCESS") {
    throw new Error("Express payment has not been confirmed");
  }

  const config = await getExpressPricingConfig();
  const otp = generateOtp();
  const expiresAt = new Date(
    Date.now() + config.pickupOtpTtlMinutes * 60 * 1000,
  );

  await prisma.expressBooking.update({
    where: { id: expressBookingId },
    data: {
      deliveryOtpHash: hashOtp(otp),
      deliveryOtpExpiresAt: expiresAt,
      deliveryOtpVerifiedAt: null,
    },
  });

  await Promise.allSettled([
    sendExpressDeliveryOtp(
      {
        email: expressBooking.booking.customer.email,
        phone: expressBooking.booking.customer.phone,
        firstName: expressBooking.booking.customer.firstName,
      },
      otp,
      config.pickupOtpTtlMinutes,
    ),
  ]);

  return {
    expressBookingId,
    status: "ACTIVE" as const,
    expiresAt,
  };
}

export async function verifyExpressDelivery(
  expressBookingId: string,
  transporterId: string,
  otp: string,
) {
  const normalizedOtp = otp.trim();

  if (!/^\d{6}$/.test(normalizedOtp)) {
    throw new Error("Delivery verification code must be 6 digits");
  }

  const result = await prisma.$transaction(async (tx) => {
    const expressBooking = await tx.expressBooking.findUnique({
      where: { id: expressBookingId },
      include: {
        booking: true,
      },
    });

    if (!expressBooking) {
      throw new Error("Express booking not found");
    }

    if (expressBooking.status !== "ACTIVE") {
      if (expressBooking.status === "COMPLETED") {
        const payment = await tx.payment.findFirst({
          where: {
            bookingId: expressBooking.bookingId,
            status: "SUCCESS",
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        const existingSettlement = payment
          ? await tx.settlement.findUnique({
              where: { paymentId: payment.id },
            })
          : null;

        if (existingSettlement?.status === "RELEASED") {
          return {
            alreadyCompleted: true,
            booking: expressBooking.booking,
            expressBookingId,
            settlement: existingSettlement,
          };
        }
      }

      throw new Error("Express booking is not active");
    }

    if (expressBooking.booking.transporterId !== transporterId) {
      throw new Error("You are not assigned to this Express booking");
    }

    if (expressBooking.booking.paymentStatus !== "SUCCESS") {
      throw new Error("Express payment has not been confirmed");
    }

    if (
      !expressBooking.deliveryOtpHash ||
      !expressBooking.deliveryOtpExpiresAt
    ) {
      throw new Error("Delivery verification code is unavailable");
    }

    if (expressBooking.deliveryOtpExpiresAt.getTime() < Date.now()) {
      throw new Error("Delivery verification code has expired");
    }

    if (hashOtp(normalizedOtp) !== expressBooking.deliveryOtpHash) {
      throw new Error("Invalid delivery verification code");
    }

    const payment = await tx.payment.findFirst({
      where: {
        bookingId: expressBooking.bookingId,
        status: "SUCCESS",
        provider: "PAYSTACK",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!payment) {
      throw new Error("Successful Express payment not found");
    }

    const existingSettlement = await tx.settlement.findUnique({
      where: { paymentId: payment.id },
    });

    if (existingSettlement?.status === "RELEASED") {
      const completed = await tx.expressBooking.updateMany({
        where: {
          id: expressBookingId,
          status: "ACTIVE",
        },
        data: {
          status: "COMPLETED",
          deliveryOtpHash: null,
          deliveryOtpExpiresAt: null,
          deliveryOtpVerifiedAt: new Date(),
        },
      });

      if (completed.count !== 1) {
        throw new Error("Express completion could not be claimed");
      }

      const booking = await tx.booking.update({
        where: { id: expressBooking.bookingId },
        data: {
          status: "COMPLETED",
          deliveredAt: new Date(),
          completedAt: new Date(),
          paymentStatus: "SUCCESS",
        },
      });

      if (booking.vehicleId) {
        await tx.vehicle.updateMany({
          where: {
            id: booking.vehicleId,
            availabilityStatus: "ON_TRIP",
          },
          data: {
            availabilityStatus: "AVAILABLE",
          },
        });
      }

      return {
        alreadyCompleted: false,
        booking,
        expressBookingId,
        settlement: existingSettlement,
      };
    }

    const settlement =
      existingSettlement ??
      (await createSettlementInTransaction(
        tx,
        expressBooking.bookingId,
        payment.id,
      ));

    if (settlement.status === "RELEASED") {
      throw new Error("Express settlement has already been released");
    }

    const wallet = await tx.wallet.findUnique({
      where: {
        transporterId: transporterId,
      },
    });

    if (!wallet) {
      throw new Error("Transporter wallet not found");
    }

    const releasedAt = new Date();

    const releasedSettlement = await tx.settlement.updateMany({
      where: {
        id: settlement.id,
        status: settlement.status,
      },
      data: {
        status: "RELEASED",
        releasedAt,
        releasedBy: null,
      },
    });

    if (releasedSettlement.count !== 1) {
      throw new Error("Express settlement could not be released");
    }

    await tx.wallet.update({
      where: {
        id: wallet.id,
      },
      data: {
        availableBalance: {
          increment: settlement.netAmount,
        },
      },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        bookingId: settlement.bookingId,
        amount: settlement.netAmount,
        transactionType: "SETTLEMENT_RELEASED",
        description:
          "Express shipment settlement released immediately after customer delivery verification",
      },
    });

    const completed = await tx.expressBooking.updateMany({
      where: {
        id: expressBookingId,
        status: "ACTIVE",
      },
      data: {
        status: "COMPLETED",
        deliveryOtpHash: null,
        deliveryOtpExpiresAt: null,
        deliveryOtpVerifiedAt: releasedAt,
      },
    });

    if (completed.count !== 1) {
      throw new Error("Express completion could not be claimed");
    }

    const booking = await tx.booking.update({
      where: {
        id: expressBooking.bookingId,
      },
      data: {
        status: "COMPLETED",
        deliveredAt: releasedAt,
        completedAt: releasedAt,
        paymentStatus: "SUCCESS",
      },
    });

    if (booking.vehicleId) {
      const releasedVehicle = await tx.vehicle.updateMany({
        where: {
          id: booking.vehicleId,
          availabilityStatus: "ON_TRIP",
        },
        data: {
          availabilityStatus: "AVAILABLE",
        },
      });

      if (releasedVehicle.count !== 1) {
        throw new Error("Express vehicle could not be released");
      }
    }

    return {
      alreadyCompleted: false,
      booking,
      expressBookingId,
      settlement: await tx.settlement.findUniqueOrThrow({
        where: { id: settlement.id },
      }),
    };
  });

  if (result.alreadyCompleted) {
    return result;
  }

  await createShipmentEvent({
    bookingId: result.booking.id,
    actorId: transporterId,
    eventType: "DELIVERY_CONFIRMED",
    title: "Express delivery completed",
  });

  publishEvent("booking", {
    eventType: "COMPLETED",
    module: "LIVE_TRIPS",
    entityType: "BOOKING",
    entityId: result.booking.id,
    bookingId: result.booking.id,
    actorId: transporterId,
    data: {
      status: result.booking.status,
      previousStatus: "IN_TRANSIT",
      transporterId: result.booking.transporterId,
      vehicleId: result.booking.vehicleId,
      expressBookingId: result.expressBookingId,
      settlementId: result.settlement.id,
      grossAmount: result.settlement.grossAmount,
      commissionAmount: result.settlement.commissionAmount,
      netAmount: result.settlement.netAmount,
      updatedAt: result.booking.updatedAt,
    },
  });

  return result;
}
