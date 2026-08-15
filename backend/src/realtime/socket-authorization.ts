import { prisma } from "../config/prisma.js";

export type SocketUser = {
  id: string;
  role: "CUSTOMER" | "TRANSPORTER" | "ADMIN";
  status: string;
  adminProfile?: {
    status: string;
    isSuperAdministrator: boolean;
    administratorType: string;
    assignedModules: string[];
  } | null;
};

export async function canAccessBooking(
  user: SocketUser,
  bookingId: string,
) {
  if (user.role === "ADMIN") {
    return true;
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      customerId: true,
      transporterId: true,
    },
  });

  if (!booking) {
    return false;
  }

  return (
    booking.customerId === user.id ||
    booking.transporterId === user.id
  );
}

export async function canUpdateVehicleLocation(
  user: SocketUser,
  bookingId: string,
) {
  if (user.role !== "TRANSPORTER") {
    return false;
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      transporterId: true,
      vehicle: {
        select: {
          transporterId: true,
        },
      },
    },
  });

  if (!booking) {
    return false;
  }

  if (booking.transporterId !== user.id) {
    return false;
  }

  if (
    booking.vehicle &&
    booking.vehicle.transporterId !== user.id
  ) {
    return false;
  }

  return true;
}

export function isValidCoordinates(
  latitude: unknown,
  longitude: unknown,
) {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}
