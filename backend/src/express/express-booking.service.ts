import crypto from "node:crypto";

import { prisma } from "../config/prisma.js";
import { calculateExpressFare } from "./express-pricing.service.js";
import { initializePaystackPayment } from "./paystack.service.js";

type ExpressBookingInput = {
  customerId: string;
  pickupLocation: string;
  pickupLandmark?: string;
  destination: string;
  destinationLandmark?: string;
  pickupLatitude: number;
  pickupLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
  scheduledDate?: Date;
  packagingType: string;
  packageCount: number;
  weightKg: number;
  cargoDescription?: string;
};

function createExpressTransactionReference() {
  return `EXP-${Date.now()}-${crypto.randomUUID()}`;
}

export async function createExpressBooking(
  data: ExpressBookingInput,
  idempotencyKey: string,
) {
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    throw new Error("Invalid idempotency key");
  }

  const customer = await prisma.user.findUnique({
    where: {
      id: data.customerId,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
    },
  });

  if (!customer) {
    throw new Error("Customer not found");
  }

  if (!customer.email) {
    throw new Error(
      "A verified customer email address is required for Express payment",
    );
  }

  const existingPayment = await prisma.payment.findFirst({
    where: {
      customerId: data.customerId,
      idempotencyKey,
    },
    include: {
      booking: {
        include: {
          expressBooking: true,
        },
      },
    },
  });

  if (existingPayment) {
    if (!existingPayment.booking.expressBooking) {
      throw new Error(
        "Idempotency key has already been used for a non-Express payment",
      );
    }

    return {
      booking: existingPayment.booking,
      expressBooking: existingPayment.booking.expressBooking,
      payment: existingPayment,
    };
  }

  const quote = await calculateExpressFare({
    weightKg: data.weightKg,
    packageCount: data.packageCount,
    packagingType: data.packagingType,
    pickupLatitude: data.pickupLatitude,
    pickupLongitude: data.pickupLongitude,
    destinationLatitude: data.destinationLatitude,
    destinationLongitude: data.destinationLongitude,
  });

  const reference = createExpressTransactionReference();

  const created = await prisma.$transaction(async (tx) => {
    const concurrentPayment = await tx.payment.findFirst({
      where: {
        customerId: data.customerId,
        idempotencyKey,
      },
      include: {
        booking: {
          include: {
            expressBooking: true,
          },
        },
      },
    });

    if (concurrentPayment) {
      if (!concurrentPayment.booking.expressBooking) {
        throw new Error(
          "Idempotency key has already been used for a non-Express payment",
        );
      }

      return {
        booking: concurrentPayment.booking,
        expressBooking: concurrentPayment.booking.expressBooking,
        payment: concurrentPayment,
      };
    }

    const distanceCharge = quote.distanceCharge;
    const baseCharge = quote.baseCharge;
    const revenueTonCharge = quote.revenueTonCharge;

    const booking = await tx.booking.create({
      data: {
        customerId: data.customerId,
        pickupLocation: data.pickupLocation,
        pickupLandmark: data.pickupLandmark,
        destination: data.destination,
        destinationLandmark: data.destinationLandmark,
        pickupLatitude: data.pickupLatitude,
        pickupLongitude: data.pickupLongitude,
        destinationLatitude: data.destinationLatitude,
        destinationLongitude: data.destinationLongitude,
        scheduledDate: data.scheduledDate,
        cargoDescription: data.cargoDescription,
        cargoWeight: data.weightKg,
        fare: quote.fare,
        estimatedFare: quote.fare,
        paymentStatus: "PENDING",
        paymentMethod: "PAYSTACK",
        status: "REQUESTED",
      },
    });

    const expressBooking = await tx.expressBooking.create({
      data: {
        bookingId: booking.id,
        status: "AWAITING_PAYMENT",
        packagingType: data.packagingType,
        packageCount: data.packageCount,
        weightKg: data.weightKg,
        volumeCbm: quote.volumeCbm,
        chargeableRevenueTons: quote.chargeableRevenueTons,
        distanceKm: quote.distanceKm,
        baseCharge,
        distanceCharge,
        revenueTonCharge,
        packagingCharge: quote.packagingCharge,
        fare: quote.fare,
        currency: quote.currency,
        kgPerMetricTon: quote.kgPerMetricTon,
        volumeCbmPerPackage: quote.volumeCbmPerPackage,
        distanceRatePerKm: quote.distanceRatePerKm,
        revenueTonRate: quote.revenueTonRate,
        minimumChargeableRevenueTons:
          quote.minimumChargeableRevenueTons,
        maxCargoWeightKg: quote.maxCargoWeightKg,
      },
    });

    const payment = await tx.payment.create({
      data: {
        bookingId: booking.id,
        customerId: data.customerId,
        amount: quote.fare,
        currency: quote.currency,
        provider: "PAYSTACK",
        transactionReference: reference,
        idempotencyKey,
        status: "PENDING",
      },
    });

    return {
      booking,
      expressBooking,
      payment,
    };
  });

  let paystackPayment;

  try {
    paystackPayment = await initializePaystackPayment({
      reference: created.payment.transactionReference,
      amountNaira: Number(created.payment.amount),
      email: customer.email,
      metadata: {
        type: "EXPRESS_BOOKING",
        bookingId: created.booking.id,
        expressBookingId: created.expressBooking.id,
        paymentId: created.payment.id,
        customerId: data.customerId,
      },
    });
  } catch (error) {
    await prisma.payment.updateMany({
      where: {
        id: created.payment.id,
        status: "PENDING",
      },
      data: {
        status: "FAILED",
      },
    });

    throw error;
  }

  const payment = await prisma.payment.update({
    where: {
      id: created.payment.id,
    },
    data: {
      checkoutUrl: paystackPayment.authorizationUrl,
      providerTransactionId: paystackPayment.reference,
    },
  });

  return {
    booking: created.booking,
    expressBooking: created.expressBooking,
    payment,
    checkoutUrl: paystackPayment.authorizationUrl,
    accessCode: paystackPayment.accessCode,
    reference: paystackPayment.reference,
  };
}
