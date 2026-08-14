import { prisma } from "../config/prisma.js";
import { createShipmentEvent } from "../events/event.service.js";

export async function createBooking(data: {
  customerId: string;
  transporterId?: string;
  vehicleId?: string;
  pickupLocation: string;
  destination: string;
  pickupLatitude: number;
  pickupLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
  fare: number;
}) {
  const booking = await prisma.booking.create({
    data,
  });

  await createShipmentEvent({
    bookingId: booking.id,
    eventType: "SHIPMENT_CREATED",
    title: "Shipment created",
    description: `${booking.pickupLocation} → ${booking.destination}`,
  });

  return booking;
}

export async function getBookingById(id: string) {
  return prisma.booking.findUnique({
    where: {
      id,
    },
  });
}

export async function assignBooking(
  bookingId: string,
  transporterId: string,
  vehicleId: string,
) {
  const booking = await prisma.booking.update({
    where: {
      id: bookingId,
    },
    data: {
      transporterId,
      vehicleId,
      status: "ASSIGNED",
    },
  });

  await createShipmentEvent({
    bookingId,
    actorId: transporterId,
    eventType: "TRANSPORTER_ASSIGNED",
    title: "Transporter assigned",
    description: `Vehicle ${vehicleId} assigned`,
  });

  return booking;
}

export async function updateBookingStatus(
  bookingId: string,
  status:
    | "ACCEPTED"
    | "DRIVER_ARRIVING"
    | "ARRIVED"
    | "IN_TRANSIT"
    | "COMPLETED"
    | "CANCELLED",
) {
  const timestampData: any = {
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

    case "COMPLETED":
      timestampData.deliveredAt = new Date();
      timestampData.completedAt = new Date();
      break;
  }

  const booking = await prisma.booking.update({
    where: {
      id: bookingId,
    },
    data: timestampData,
  });

  const eventMap = {
    ACCEPTED: {
      eventType: "SHIPMENT_ACCEPTED",
      title: "Shipment accepted",
    },

    IN_TRANSIT: {
      eventType: "IN_TRANSIT",
      title: "Shipment in transit",
    },

    COMPLETED: {
      eventType: "DELIVERY_CONFIRMED",
      title: "Delivery completed",
    },
  };

  const event =
    eventMap[status as keyof typeof eventMap];

  if (event) {
    await createShipmentEvent({
      bookingId,
      eventType: event.eventType as any,
      title: event.title,
    });
  }

  return booking;
}
 

export async function getCustomerBookings(
  customerId: string,
) {
  return prisma.booking.findMany({
    where: {
      customerId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getTransporterBookings(
  transporterId: string,
) {
  return prisma.booking.findMany({
    where: {
      transporterId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function uploadProofOfDelivery(
  bookingId: string,
  proofOfDelivery: string,
  deliveryConfirmationCode: string,
) {
  return prisma.booking.update({
    where: {
      id: bookingId,
    },
    data: {
      proofOfDelivery,
      deliveryConfirmationCode,
      status: "ARRIVED",
    },
  });
}

export async function confirmDelivery(
  bookingId: string,
  code: string,
) {
  const booking =
    await prisma.booking.findUnique({
      where: {
        id: bookingId,
      },
    });

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (!booking.transporterId) {
    throw new Error(
      "No transporter assigned",
    );
  }

  if (
    booking.deliveryConfirmationCode !==
    code
  ) {
    throw new Error(
      "Invalid confirmation code",
    );
  }

  const wallet =
    await prisma.wallet.findUnique({
      where: {
        transporterId:
          booking.transporterId,
      },
    });

  if (!wallet) {
    throw new Error(
      "Transporter wallet not found",
    );
  }

  await prisma.wallet.update({
    where: {
      id: wallet.id,
    },
    data: {
      pendingBalance: {
        increment: booking.fare,
      },
    },
  });

  await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      bookingId: booking.id,
      amount: booking.fare,
      transactionType: "CREDIT",
      description:
        "Shipment payment",
    },
  });

  return prisma.booking.update({
    where: {
      id: bookingId,
    },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });
}
