import crypto from "node:crypto";
import { prisma } from "../config/prisma.js";
import { getExpressPricingConfig } from "./express-pricing.service.js";
import { createShipmentEvent } from "../events/event.service.js";
import { publishEvent } from "../realtime/event-bus.js";

const OTP_LENGTH = 6;

function generateOtp(): string {
  return crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
}

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export async function prepareExpressPickupVerification(
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
          cargoWeight: true,
          status: true,
          paymentStatus: true,
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

  if (expressBooking.status !== "ASSIGNED") {
    throw new Error("Express booking is not ready for pickup verification");
  }

  if (!expressBooking.booking.transporterId) {
    throw new Error("No transporter assigned");
  }

  if (expressBooking.booking.paymentStatus !== "SUCCESS") {
    throw new Error("Express payment has not been confirmed");
  }

  const config = await getExpressPricingConfig();
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + config.pickupOtpTtlMinutes * 60 * 1000);

  await prisma.expressBooking.update({
    where: { id: expressBookingId },
    data: {
      status: "PICKUP_VERIFICATION",
      pickupOtpHash: hashOtp(otp),
      pickupOtpExpiresAt: expiresAt,
    },
  });

  return {
    expressBookingId,
    status: "PICKUP_VERIFICATION" as const,
    otp,
    expiresAt,
  };
}

export async function verifyExpressPickup(
  expressBookingId: string,
  transporterId: string,
  otp: string,
) {
  const normalizedOtp = otp.trim();

  if (!/^\d{6}$/.test(normalizedOtp)) {
    throw new Error("Pickup verification code must be 6 digits");
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

    if (expressBooking.status !== "PICKUP_VERIFICATION") {
      throw new Error("Express booking is not awaiting pickup verification");
    }

    if (expressBooking.booking.transporterId !== transporterId) {
      throw new Error("You are not assigned to this Express booking");
    }

    if (
      !expressBooking.pickupOtpHash ||
      !expressBooking.pickupOtpExpiresAt
    ) {
      throw new Error("Pickup verification code is unavailable");
    }

    if (expressBooking.pickupOtpExpiresAt.getTime() < Date.now()) {
      throw new Error("Pickup verification code has expired");
    }

    if (hashOtp(normalizedOtp) !== expressBooking.pickupOtpHash) {
      throw new Error("Invalid pickup verification code");
    }

    const claimed = await tx.expressBooking.updateMany({
      where: {
        id: expressBookingId,
        status: "PICKUP_VERIFICATION",
      },
      data: {
        status: "ACTIVE",
        pickupVerifiedAt: new Date(),
        pickupOtpHash: null,
        pickupOtpExpiresAt: null,
      },
    });

    if (claimed.count !== 1) {
      throw new Error("Pickup verification already completed");
    }

    const booking = await tx.booking.update({
      where: { id: expressBooking.bookingId },
      data: {
        status: "IN_TRANSIT",
        pickedUpAt: new Date(),
        inTransitAt: new Date(),
        trackingShareToken: crypto.randomBytes(32).toString("hex"),
      },
    });

    return {
      booking,
      expressBookingId,
    };
  });

  await createShipmentEvent({
    bookingId: result.booking.id,
    actorId: transporterId,
    eventType: "IN_TRANSIT",
    title: "Express shipment in transit",
  });

  publishEvent("booking", {
    eventType: "IN_TRANSIT",
    module: "LIVE_TRIPS",
    entityType: "BOOKING",
    entityId: result.booking.id,
    bookingId: result.booking.id,
    actorId: transporterId,
    data: {
      status: result.booking.status,
      previousStatus: "ASSIGNED",
      transporterId: result.booking.transporterId,
      vehicleId: result.booking.vehicleId,
      updatedAt: result.booking.updatedAt,
      expressBookingId: result.expressBookingId,
    },
  });

  return result;
}
