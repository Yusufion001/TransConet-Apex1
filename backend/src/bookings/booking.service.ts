import { randomInt } from "node:crypto";
import { prisma } from "../config/prisma.js";
import { createShipmentEvent } from "../events/event.service.js";
import { publishEvent } from "../realtime/event-bus.js";
import { publishAdminEvent, publishBookingEvent } from "../realtime/realtime.service.js";
import { createSettlement } from "../settlements/settlement.service.js";
import { toBookingDto } from "./booking.dto.js";
import { estimateFare } from "../pricing/pricing.service.js";
import { createBankTransferPayment } from "../payments/bank-transfer.service.js";

export async function createBooking(data: {
  customerId: string;
  pickupLocation: string;
  destination: string;
  pickupLatitude: number;
  pickupLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
  cargoDescription?: string;
  truckCategory: "MINI_TRUCK"
    | "LIGHT_TRUCK"
    | "MEDIUM_TRUCK"
    | "HEAVY_TRUCK"
    | "CONTAINER_TRUCK"
    | "REFRIGERATED_TRUCK"
    | "TANKER"
    | "SPECIALIZED";
  cargoCategory?: "GENERAL"
    | "FRAGILE"
    | "ELECTRONICS"
    | "FURNITURE"
    | "AGRICULTURAL"
    | "INDUSTRIAL"
    | "CONSTRUCTION"
    | "HAZARDOUS"
    | "REFRIGERATED";
  cargoWeight: number;
  paymentMethod?: "FLUTTERWAVE" | "BANK_TRANSFER" | "NEGOTIATE";
}) {
  const pricing = await estimateFare({
    weight: data.cargoWeight,
    truck: data.truckCategory,
    pickupLatitude: data.pickupLatitude,
    pickupLongitude: data.pickupLongitude,
    destinationLatitude: data.destinationLatitude,
    destinationLongitude: data.destinationLongitude,
  });

  const deliveryConfirmationCode = String(randomInt(0, 100_000_000)).padStart(8, "0");

  const paymentMethod = data.paymentMethod ?? "FLUTTERWAVE";

  const booking = await prisma.$transaction(async (tx) => {
    const createdBooking = await tx.booking.create({
      data: {
        customerId: data.customerId,
        pickupLocation: data.pickupLocation,
        destination: data.destination,
        pickupLatitude: data.pickupLatitude,
        pickupLongitude: data.pickupLongitude,
        destinationLatitude: data.destinationLatitude,
        destinationLongitude: data.destinationLongitude,
        cargoDescription: data.cargoDescription,
        truckCategory: data.truckCategory,
        cargoCategory: data.cargoCategory,
        cargoWeight: data.cargoWeight,
        estimatedFare: pricing.fare,
        fare: pricing.fare,
        paymentMethod,
        deliveryConfirmationCode,
      },
    });

    if (paymentMethod === "BANK_TRANSFER") {
      await createBankTransferPayment(tx, {
        id: createdBooking.id,
        customerId: createdBooking.customerId,
        fare: createdBooking.fare,
      });
    }

    if (paymentMethod === "NEGOTIATE") {
      await tx.marketplaceRequest.create({
        data: {
          customerId: data.customerId,
          bookingId: createdBooking.id,
          cargoDescription: data.cargoDescription,
          truckCategory: data.truckCategory,
          cargoCategory: data.cargoCategory,
          cargoWeight: data.cargoWeight,
          pickupLocation: data.pickupLocation,
          destination: data.destination,
          pickupLatitude: data.pickupLatitude,
          pickupLongitude: data.pickupLongitude,
          destinationLatitude: data.destinationLatitude,
          destinationLongitude: data.destinationLongitude,
          scheduledDate: null,
          estimatedFare: pricing.fare,
          status: "OPEN",
        },
      });
    }

    return createdBooking;
  });

  const bookingDto = toBookingDto(booking);

  publishBookingEvent(booking.id, {
    eventType: "booking.created",
    module: "PLATFORM_OVERVIEW",
    actorId: booking.customerId,
    entityType: "BOOKING",
    entityId: booking.id,
    data: bookingDto,
  });

  await createShipmentEvent({
    bookingId: booking.id,
    eventType: "SHIPMENT_CREATED",
    title: "Shipment created",
    description: `${booking.pickupLocation} → ${booking.destination}`,
  });

  publishEvent("booking", {
    eventType: "SHIPMENT_CREATED",
    module: "LIVE_TRIPS",
    entityType: "BOOKING",
    entityId: booking.id,
    bookingId: booking.id,
    actorId: booking.customerId,
    data: {
      status: booking.status,
      pickupLocation: booking.pickupLocation,
      destination: booking.destination,
      fare: booking.fare,
    },
  });

  return bookingDto;
}

export async function assertBookingAccess(
  bookingId: string,
  userId: string,
  role: string,
  action: "read" | "assign" | "status" | "proof" | "confirm" = "read",
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, customerId: true, transporterId: true },
  });

  if (!booking) throw new Error("Booking not found");
  if (role === "ADMIN") return booking;

  if (action === "read" &&
      ((role === "CUSTOMER" && booking.customerId === userId) ||
       (role === "TRANSPORTER" && booking.transporterId === userId))) return booking;

  if ((action === "status" || action === "proof") &&
      role === "TRANSPORTER" && booking.transporterId === userId) return booking;

  if (action === "confirm" &&
      role === "CUSTOMER" && booking.customerId === userId) return booking;

  throw new Error("Access denied");
}

export async function getBookingById(id: string) {
  const booking = await prisma.booking.findUnique({
    where: {
      id,
    },
  });

  return booking ? toBookingDto(booking) : null;
}

export async function assignBooking(
  bookingId: string,
  transporterId: string,
  vehicleId: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    const transporter = await tx.user.findUnique({
      where: { id: transporterId },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });

    if (!transporter || transporter.role !== "TRANSPORTER") {
      throw new Error("Invalid transporter");
    }

    if (transporter.status !== "ACTIVE") {
      throw new Error("Transporter account is not active");
    }

    const vehicle = await tx.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        id: true,
        transporterId: true,
        availabilityStatus: true,
        verificationStatus: true,
      },
    });

    if (!vehicle) {
      throw new Error("Vehicle not found");
    }

    if (vehicle.transporterId !== transporterId) {
      throw new Error("Vehicle does not belong to transporter");
    }

    if (vehicle.verificationStatus !== "APPROVED") {
      throw new Error("Vehicle is not approved");
    }

    if (vehicle.availabilityStatus !== "AVAILABLE") {
      throw new Error("Vehicle is not available");
    }

    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        transporterId,
        vehicleId,
        status: "ASSIGNED",
      },
    });

    await tx.vehicle.update({
      where: { id: vehicleId },
      data: {
        availabilityStatus: "ON_TRIP",
      },
    });

    return updated;
  });

  const resultDto = toBookingDto(result);

  publishBookingEvent(bookingId, {
    eventType: "booking.assigned",
    module: "LIVE_TRIPS",
    actorId: transporterId,
    entityType: "BOOKING",
    entityId: bookingId,
    data: {
      transporterId,
      vehicleId,
      status: resultDto.status,
    },
  });

  await createShipmentEvent({
    bookingId,
    actorId: transporterId,
    eventType: "TRANSPORTER_ASSIGNED",
    title: "Transporter assigned",
    description: `Vehicle ${vehicleId} assigned`,
  });

  publishEvent("booking", {
    eventType: "TRANSPORTER_ASSIGNED",
    module: "LIVE_TRIPS",
    entityType: "BOOKING",
    entityId: result.id,
    bookingId: result.id,
    actorId: transporterId,
    data: {
      transporterId,
      vehicleId,
      status: result.status,
    },
  });

  return resultDto;
}

export async function updateBookingStatus(
  bookingId: string,
  status:
    | "ACCEPTED"
    | "DRIVER_ARRIVING"
    | "ARRIVED"
    | "IN_TRANSIT"
    | "CANCELLED",
) {
  const result = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        transporterId: true,
        vehicleId: true,
      },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    const allowedTransitions: Record<string, string[]> = {
      REQUESTED: ["CANCELLED"],
      SEARCHING: ["CANCELLED"],
      ASSIGNED: ["ACCEPTED", "CANCELLED"],
      ACCEPTED: ["DRIVER_ARRIVING", "CANCELLED"],
      DRIVER_ARRIVING: ["ARRIVED", "CANCELLED"],
      ARRIVED: ["IN_TRANSIT", "CANCELLED"],
      IN_TRANSIT: ["CANCELLED"],
      DISPUTED: ["CANCELLED"],
      COMPLETED: [],
      CANCELLED: [],
    };

    const allowed = allowedTransitions[booking.status] ?? [];

    if (!allowed.includes(status)) {
      throw new Error(
        `Invalid booking status transition: ${booking.status} -> ${status}`,
      );
    }

    const timestampData: {
      status: typeof status;
      acceptedAt?: Date;
      arrivedAt?: Date;
      pickedUpAt?: Date;
      inTransitAt?: Date;
      deliveredAt?: Date;
      completedAt?: Date;
    } = {
      status,
    };

    switch (status) {
      case "ACCEPTED":
        timestampData.acceptedAt = new Date();
        break;

      case "ARRIVED":
        timestampData.arrivedAt = new Date();
        break;

      case "IN_TRANSIT":
        timestampData.inTransitAt = new Date();
        timestampData.pickedUpAt = new Date();
        break;

      /*
       * COMPLETED is intentionally excluded from this service.
       * Delivery completion must go through confirmDelivery(), which
       * atomically verifies payment and releases the transporter funds.
       */
    }

    const updatedBooking = await tx.booking.update({
      where: { id: bookingId },
      data: timestampData,
    });

    if (status === "CANCELLED" && booking.vehicleId) {
      await tx.vehicle.update({
        where: { id: booking.vehicleId },
        data: {
          availabilityStatus: "AVAILABLE",
        },
      });
    }

    return {
      booking: updatedBooking,
      previousStatus: booking.status,
    };
  });

  const eventMap: Partial<Record<
    typeof status,
    {
      eventType:
        | "SHIPMENT_ACCEPTED"
        | "IN_TRANSIT"
        | "DELIVERY_CONFIRMED";
      title: string;
    }
  >> = {
    ACCEPTED: {
      eventType: "SHIPMENT_ACCEPTED",
      title: "Shipment accepted",
    },
    IN_TRANSIT: {
      eventType: "IN_TRANSIT",
      title: "Shipment in transit",
    },
  };

  const shipmentEvent = eventMap[status];

  if (shipmentEvent) {
    await createShipmentEvent({
      bookingId,
      eventType: shipmentEvent.eventType,
      title: shipmentEvent.title,
    });
  }

  const resultBookingDto = toBookingDto(result.booking);

  publishEvent("booking", {
    eventType: status,
    module: "LIVE_TRIPS",
    entityType: "BOOKING",
    entityId: resultBookingDto.id,
    bookingId: resultBookingDto.id,
    data: {
      status: resultBookingDto.status,
      previousStatus: result.previousStatus,
      transporterId: resultBookingDto.transporterId,
      vehicleId: resultBookingDto.vehicleId,
      updatedAt: resultBookingDto.updatedAt,
    },
  });

  if (status === "CANCELLED" && result.booking.vehicleId) {
    publishEvent("vehicle", {
      eventType: "VEHICLE_AVAILABILITY_UPDATED",
      module: "FLEET_MARKETPLACE",
      entityType: "VEHICLE",
      entityId: result.booking.vehicleId,
      actorId: result.booking.transporterId ?? undefined,
      data: {
        vehicleId: result.booking.vehicleId,
        transporterId: result.booking.transporterId,
        availabilityStatus: "AVAILABLE",
        bookingId: result.booking.id,
      },
    });
  }

  return resultBookingDto;
}


export async function getCustomerBookings(
  customerId: string,
) {
  const bookings = await prisma.booking.findMany({
    where: {
      customerId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return bookings.map(toBookingDto);
}

export async function getTransporterBookings(
  transporterId: string,
) {
  const bookings = await prisma.booking.findMany({
    where: {
      transporterId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return bookings.map(toBookingDto);
}

export async function uploadProofOfDelivery(
  bookingId: string,
  proofOfDelivery: string,
) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, status: true },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.status !== "ARRIVED") {
      throw new Error("Proof of delivery can only be submitted after arrival");
    }

    const updatedBooking = await tx.booking.update({
      where: {
        id: bookingId,
      },
      data: {
        proofOfDelivery,
      },
    });

    return toBookingDto(updatedBooking);
  });
}


export async function getDeliveryConfirmationCode(
  bookingId: string,
  customerId: string,
): Promise<string> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      customerId: true,
      status: true,
      proofOfDelivery: true,
      deliveryConfirmationCode: true,
    },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.customerId !== customerId) {
    throw new Error("Access denied");
  }

  if (booking.status !== "ARRIVED") {
    throw new Error(
      "Delivery confirmation code is only available after arrival",
    );
  }

  if (!booking.proofOfDelivery) {
    throw new Error(
      "Delivery confirmation code is only available after proof of delivery",
    );
  }

  if (!booking.deliveryConfirmationCode) {
    throw new Error("Delivery confirmation code is unavailable");
  }

  return booking.deliveryConfirmationCode;
}

export async function confirmDelivery(
  bookingId: string,
  code: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: {
        id: bookingId,
      },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.status === "COMPLETED") {
      throw new Error("Delivery already confirmed");
    }

    if (!booking.transporterId) {
      throw new Error("No transporter assigned");
    }

    if (booking.status !== "ARRIVED") {
      throw new Error("Shipment has not arrived");
    }

    if (booking.deliveryConfirmationCode !== code) {
      throw new Error("Invalid confirmation code");
    }

    const claimed = await tx.booking.updateMany({
      where: {
        id: bookingId,
        status: "ARRIVED",
      },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    if (claimed.count !== 1) {
      throw new Error("Delivery already confirmed");
    }

    const payment = await tx.payment.findFirst({
      where: {
        bookingId: booking.id,
        status: "SUCCESS",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!payment) {
      throw new Error("Successful shipment payment not found");
    }

    if (booking.vehicleId) {
      await tx.vehicle.update({
        where: {
          id: booking.vehicleId,
        },
        data: {
          availabilityStatus: "AVAILABLE",
        },
      });
    }

    const completedBooking = await tx.booking.update({
      where: {
        id: bookingId,
      },
      data: {
        paymentStatus: "SUCCESS",
      },
    });

    return {
      booking: completedBooking,
      transporterId: booking.transporterId,
      vehicleId: booking.vehicleId,
      paymentId: payment.id,
    };
  });

  const completedBookingDto = toBookingDto(result.booking);

  publishBookingEvent(bookingId, {
    eventType: "booking.completed",
    module: "LIVE_TRIPS",
    entityType: "BOOKING",
    entityId: bookingId,
    data: completedBookingDto,
  });

  const settlement = await createSettlement(
    bookingId,
    result.paymentId,
  );

  await createShipmentEvent({
    bookingId,
    actorId: result.transporterId,
    eventType: "DELIVERY_CONFIRMED",
    title: "Delivery confirmed",
    description:
      "Delivery was confirmed and a settlement was created for administrative approval.",
  });

  return completedBookingDto;
}

