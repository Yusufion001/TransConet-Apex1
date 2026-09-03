import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";
import { estimateFare } from "../pricing/pricing.service.js";
import { calculateCommission } from "../settlements/commission.service.js";


async function expireMarketplaceLifecycle() {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const expiredBids = await tx.marketplaceBid.findMany({
      where: {
        status: "PENDING",
        expiresAt: {
          not: null,
          lte: now,
        },
      },
      select: {
        id: true,
        requestId: true,
        transporterId: true,
      },
    });

    if (expiredBids.length > 0) {
      await tx.marketplaceBid.updateMany({
        where: {
          id: {
            in: expiredBids.map((bid) => bid.id),
          },
          status: "PENDING",
          expiresAt: {
            not: null,
            lte: now,
          },
        },
        data: {
          status: "EXPIRED",
        },
      });
    }

    /*
     * MarketplaceRequest.scheduledDate represents the planned
     * shipment/pickup date. It is NOT the marketplace request's
     * expiration timestamp.
     *
     * Therefore a scheduled load must remain OPEN until:
     * - a bid is selected, or
     * - the request is explicitly closed by another lifecycle action.
     *
     * Only MarketplaceBid.expiresAt controls bid expiration.
     */

    return {
      expiredBidIds: expiredBids.map((bid) => bid.id),
    };
  });
}


function serializeMarketplaceBid(bid: {
  id: string;
  requestId: string;
  transporterId: string;
  vehicleId: string;
  amount: unknown;
  message: string | null;
  status: string;
  expiresAt: Date | null;
  selectedAt?: Date | null;
  createdAt: Date;
  vehicle?: {
    id: string;
    vehicleType: unknown;
    vehicleClass: unknown;
  } | null;
  transporter?: {
    id: string;
    firstName: string;
    lastName: string;
    transporterTier: unknown;
    transporterProfile?: {
      rating: unknown;
      totalTrips: number;
    } | null;
  } | null;
}) {
  return {
    id: bid.id,
    requestId: bid.requestId,
    transporterId: bid.transporterId,
    vehicleId: bid.vehicleId,
    amount: bid.amount,
    message: bid.message,
    status: bid.status,
    expiresAt: bid.expiresAt,
    selectedAt: bid.selectedAt ?? null,
    createdAt: bid.createdAt,
    vehicle: bid.vehicle
      ? {
          id: bid.vehicle.id,
          vehicleType: bid.vehicle.vehicleType,
          vehicleClass: bid.vehicle.vehicleClass,
        }
      : undefined,
    transporter: bid.transporter
      ? {
          id: bid.transporter.id,
          firstName: bid.transporter.firstName,
          lastName: bid.transporter.lastName,
          transporterTier: bid.transporter.transporterTier,
          rating: bid.transporter.transporterProfile?.rating ?? null,
          totalTrips:
            bid.transporter.transporterProfile?.totalTrips ?? 0,
        }
      : undefined,
  };
}

export async function createMarketplaceRequest(data: {
  customerId: string;
  pickupLocation: string;
  destination: string;
  pickupLatitude: number;
  pickupLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
  cargoDescription?: string;
  truckCategory:
    | "MINI_TRUCK"
    | "LIGHT_TRUCK"
    | "MEDIUM_TRUCK"
    | "HEAVY_TRUCK"
    | "CONTAINER_TRUCK"
    | "REFRIGERATED_TRUCK"
    | "TANKER"
    | "SPECIALIZED";
  cargoCategory?:
    | "GENERAL"
    | "FRAGILE"
    | "ELECTRONICS"
    | "FURNITURE"
    | "AGRICULTURAL"
    | "INDUSTRIAL"
    | "CONSTRUCTION"
    | "HAZARDOUS"
    | "REFRIGERATED";
  cargoWeight: number;
  scheduledDate?: Date;
}) {
  const pricing = await estimateFare({
    weight: data.cargoWeight,
    truck: data.truckCategory,
    pickupLatitude: data.pickupLatitude,
    pickupLongitude: data.pickupLongitude,
    destinationLatitude: data.destinationLatitude,
    destinationLongitude: data.destinationLongitude,
  });

  const request = await prisma.marketplaceRequest.create({
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
      scheduledDate: data.scheduledDate,
      estimatedFare: pricing.fare,
      status: "OPEN",
    },
  });

  publishEvent("marketplace", {
    eventType: "LOAD_POSTED",
    module: "FLEET_MARKETPLACE",
    entityType: "MARKETPLACE_REQUEST",
    entityId: request.id,
    actorId: data.customerId,
    data: {
      requestId: request.id,
      status: request.status,
      pickupLocation: request.pickupLocation,
      destination: request.destination,
      truckCategory: request.truckCategory,
      cargoWeight: request.cargoWeight,
      estimatedFare: request.estimatedFare,
    },
  });

  return request;
}

export async function getMarketplaceRequest(
  requestId: string,
  customerId: string,
) {
  await expireMarketplaceLifecycle();

  const request = await prisma.marketplaceRequest.findFirst({
    where: {
      id: requestId,
      customerId,
    },
    select: {
      id: true,
      customerId: true,
      bookingId: true,
      cargoDescription: true,
      truckCategory: true,
      cargoCategory: true,
      cargoWeight: true,
      pickupLocation: true,
      destination: true,
      pickupLatitude: true,
      pickupLongitude: true,
      destinationLatitude: true,
      destinationLongitude: true,
      scheduledDate: true,
      estimatedFare: true,
      status: true,
      agreedBidId: true,
      createdAt: true,
      updatedAt: true,
      closedAt: true,
      bids: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          requestId: true,
          transporterId: true,
          vehicleId: true,
          amount: true,
          message: true,
          status: true,
          expiresAt: true,
          selectedAt: true,
          createdAt: true,
          vehicle: {
            select: {
              id: true,
              vehicleType: true,
              vehicleClass: true,
            },
          },
          transporter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              transporterTier: true,
              transporterProfile: {
                select: {
                  rating: true,
                  totalTrips: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!request) {
    return null;
  }

  return {
    ...request,
    bids: request.bids.map(serializeMarketplaceBid),
  };
}

export async function createMarketplaceBid(data: {
  requestId: string;
  transporterId: string;
  vehicleId: string;
  amount: number;
  message?: string;
  expiresAt?: Date;
}) {
  await expireMarketplaceLifecycle();

  const request = await prisma.marketplaceRequest.findUnique({
    where: { id: data.requestId },
    select: {
      id: true,
      status: true,
      truckCategory: true,
      scheduledDate: true,
      customerId: true,
    },
  });

  if (!request) {
    throw new Error("Marketplace request not found");
  }

  if (request.status !== "OPEN") {
    throw new Error("Marketplace request is no longer accepting bids");
  }

  if (request.customerId === data.transporterId) {
    throw new Error("Customer cannot bid on their own marketplace request");
  }

  const transporter = await prisma.user.findUnique({
    where: { id: data.transporterId },
    select: {
      id: true,
      role: true,
      status: true,
      transporterProfile: {
        select: {
          verificationStatus: true,
        },
      },
    },
  });

  if (!transporter || transporter.role !== "TRANSPORTER") {
    throw new Error("Only transporters can submit bids");
  }

  if (transporter.status !== "ACTIVE") {
    throw new Error("Transporter account is not active");
  }

  if (
    !transporter.transporterProfile ||
    transporter.transporterProfile.verificationStatus !== "APPROVED"
  ) {
    throw new Error("Transporter is not approved");
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: data.vehicleId },
    select: {
      id: true,
      transporterId: true,
      vehicleType: true,
      vehicleClass: true,
      verificationStatus: true,
      availabilityStatus: true,
    },
  });

  if (!vehicle) {
    throw new Error("Vehicle not found");
  }

  if (vehicle.transporterId !== data.transporterId) {
    throw new Error("Vehicle does not belong to transporter");
  }

  if (vehicle.verificationStatus !== "APPROVED") {
    throw new Error("Vehicle is not approved");
  }

  if (vehicle.availabilityStatus !== "AVAILABLE") {
    throw new Error("Vehicle is not available");
  }

  if (
    request.truckCategory &&
    vehicle.vehicleType !== request.truckCategory &&
    vehicle.vehicleClass !== request.truckCategory
  ) {
    throw new Error("Vehicle does not match requested truck category");
  }

  if (data.expiresAt && data.expiresAt <= new Date()) {
    throw new Error("Bid expiration must be in the future");
  }

  try {
    const bid = await prisma.marketplaceBid.create({
      data: {
        requestId: data.requestId,
        transporterId: data.transporterId,
        vehicleId: data.vehicleId,
        amount: data.amount,
        message: data.message,
        expiresAt: data.expiresAt,
        status: "PENDING",
      },
      include: {
        vehicle: true,
      },
    });

    publishEvent("marketplace", {
      eventType: "BID_SUBMITTED",
      module: "FLEET_MARKETPLACE",
      entityType: "MARKETPLACE_BID",
      entityId: bid.id,
      actorId: data.transporterId,
      data: {
        bidId: bid.id,
        requestId: data.requestId,
        transporterId: data.transporterId,
        vehicleId: data.vehicleId,
        amount: bid.amount,
        status: bid.status,
      },
    });

    return bid;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      throw new Error("Transporter has already submitted a bid for this request");
    }

    throw error;
  }
}

export async function withdrawMarketplaceBid(
  bidId: string,
  transporterId: string,
) {
  await expireMarketplaceLifecycle();
  const bid = await prisma.marketplaceBid.findUnique({
    where: { id: bidId },
    select: {
      id: true,
      requestId: true,
      transporterId: true,
      status: true,
    },
  });

  if (!bid) {
    throw new Error("Marketplace bid not found");
  }

  if (bid.transporterId !== transporterId) {
    throw new Error("Access denied");
  }

  if (bid.status !== "PENDING") {
    throw new Error("Only pending bids can be withdrawn");
  }

  const updated = await prisma.marketplaceBid.update({
    where: { id: bidId },
    data: {
      status: "WITHDRAWN",
    },
  });

  publishEvent("marketplace", {
    eventType: "BID_WITHDRAWN",
    module: "FLEET_MARKETPLACE",
    entityType: "MARKETPLACE_BID",
    entityId: updated.id,
    actorId: transporterId,
    data: {
      bidId: updated.id,
      requestId: updated.requestId,
      status: updated.status,
    },
  });

  return updated;
}

export async function selectMarketplaceBid(
  requestId: string,
  bidId: string,
  customerId: string,
) {
  await expireMarketplaceLifecycle();
  const result = await prisma.$transaction(async (tx) => {
    /*
     * Read the marketplace request and verify ownership.
     * The request must still be OPEN when the selection begins.
     */
    const request = await tx.marketplaceRequest.findUnique({
      where: {
        id: requestId,
      },
      select: {
        id: true,
        customerId: true,
        status: true,
        cargoDescription: true,
        truckCategory: true,
        cargoCategory: true,
        cargoWeight: true,
        pickupLocation: true,
        destination: true,
        pickupLatitude: true,
        pickupLongitude: true,
        destinationLatitude: true,
        destinationLongitude: true,
        scheduledDate: true,
        estimatedFare: true,
        bookingId: true,
        agreedBidId: true,
      },
    });

    if (!request) {
      throw new Error("Marketplace request not found");
    }

    if (request.customerId !== customerId) {
      throw new Error("Access denied");
    }

    if (request.status !== "OPEN") {
      throw new Error("Marketplace request is no longer accepting bid selection");
    }

    /*
     * Locate the requested bid and make sure it belongs to this request.
     */
    const bid = await tx.marketplaceBid.findFirst({
      where: {
        id: bidId,
        requestId,
      },
      select: {
        id: true,
        requestId: true,
        transporterId: true,
        vehicleId: true,
        amount: true,
        message: true,
        status: true,
        expiresAt: true,
      },
    });

    if (!bid) {
      throw new Error("Marketplace bid not found");
    }

    if (bid.status !== "PENDING") {
      throw new Error("Only pending bids can be selected");
    }

    if (bid.expiresAt && bid.expiresAt <= new Date()) {
      throw new Error("Marketplace bid has expired");
    }

    /*
     * Revalidate the transporter at the moment of acceptance.
     * Visibility at bid-submission time is not sufficient because
     * transporter status can change before the customer accepts.
     */
    const transporter = await tx.user.findUnique({
      where: {
        id: bid.transporterId,
      },
      select: {
        id: true,
        role: true,
        status: true,
        transporterTier: true,
        transporterProfile: {
          select: {
            verificationStatus: true,
          },
        },
      },
    });

    if (!transporter || transporter.role !== "TRANSPORTER") {
      throw new Error("Selected transporter is invalid");
    }

    if (transporter.status !== "ACTIVE") {
      throw new Error("Selected transporter account is not active");
    }

    if (
      !transporter.transporterProfile ||
      transporter.transporterProfile.verificationStatus !== "APPROVED"
    ) {
      throw new Error("Selected transporter is not approved");
    }

    /*
     * Revalidate the vehicle and reserve it atomically.
     * This prevents two concurrent operations from assigning the same
     * available vehicle to separate trips.
     */
    const vehicle = await tx.vehicle.findUnique({
      where: {
        id: bid.vehicleId,
      },
      select: {
        id: true,
        transporterId: true,
        vehicleType: true,
        vehicleClass: true,
        verificationStatus: true,
        availabilityStatus: true,
      },
    });

    if (!vehicle) {
      throw new Error("Selected vehicle not found");
    }

    if (vehicle.transporterId !== bid.transporterId) {
      throw new Error("Selected vehicle does not belong to transporter");
    }

    if (vehicle.verificationStatus !== "APPROVED") {
      throw new Error("Selected vehicle is not approved");
    }

    if (vehicle.availabilityStatus !== "AVAILABLE") {
      throw new Error("Selected vehicle is no longer available");
    }

    if (
      request.truckCategory &&
      vehicle.vehicleType !== request.truckCategory &&
      vehicle.vehicleClass !== request.truckCategory
    ) {
      throw new Error("Selected vehicle no longer matches truck category");
    }

    /*
     * Claim the marketplace request first.
     *
     * The conditional update is the concurrency guard:
     * only one transaction can successfully move OPEN -> AGREED.
     */
    const claimedRequest = await tx.marketplaceRequest.updateMany({
      where: {
        id: requestId,
        customerId,
        status: "OPEN",
      },
      data: {
        status: "AGREED",
      },
    });

    if (claimedRequest.count !== 1) {
      throw new Error("Marketplace request has already been processed");
    }

    /*
     * Reserve the vehicle.
     */
    const reservedVehicle = await tx.vehicle.updateMany({
      where: {
        id: vehicle.id,
        transporterId: bid.transporterId,
        availabilityStatus: "AVAILABLE",
        verificationStatus: "APPROVED",
      },
      data: {
        availabilityStatus: "ON_TRIP",
      },
    });

    if (reservedVehicle.count !== 1) {
      throw new Error("Selected vehicle is no longer available");
    }

    /*
     * Select exactly this bid.
     */
    const selectedAt = new Date();

    const selectedBid = await tx.marketplaceBid.updateMany({
      where: {
        id: bid.id,
        requestId,
        status: "PENDING",
      },
      data: {
        status: "SELECTED",
        selectedAt,
      },
    });

    if (selectedBid.count !== 1) {
      throw new Error("Selected bid is no longer available");
    }

    /*
     * All other pending bids lose the competition.
     */
    await tx.marketplaceBid.updateMany({
      where: {
        requestId,
        id: {
          not: bid.id,
        },
        status: "PENDING",
      },
      data: {
        status: "REJECTED",
      },
    });

    /*
     * Marketplace acceptance creates the operational Booking.
     *
     * The accepted bid amount is authoritative for this booking.
     * We deliberately do NOT call createBooking(), because that
     * function creates a customer-originated booking and calculates
     * a fresh pricing-engine fare.
     */
    const booking = await tx.booking.create({
      data: {
        customerId,
        transporterId: bid.transporterId,
        vehicleId: bid.vehicleId,

        cargoDescription: request.cargoDescription,
        truckCategory: request.truckCategory,
        transporterTier: transporter.transporterTier,

        estimatedFare: request.estimatedFare,
        fare: bid.amount,

        pickupLocation: request.pickupLocation,
        destination: request.destination,

        pickupLatitude: request.pickupLatitude,
        pickupLongitude: request.pickupLongitude,
        destinationLatitude: request.destinationLatitude,
        destinationLongitude: request.destinationLongitude,

        scheduledDate: request.scheduledDate,

        cargoCategory: request.cargoCategory,
        cargoWeight: request.cargoWeight,

        status: "ASSIGNED",
        paymentStatus: "PENDING",
        paymentMethod: "NEGOTIATE",
      },
    });

    /*
     * Complete the marketplace <-> booking relationship.
     */
    const linkedRequest = await tx.marketplaceRequest.update({
      where: {
        id: requestId,
      },
      data: {
        agreedBidId: bid.id,
        bookingId: booking.id,
        closedAt: new Date(),
      },
    });

    /*
     * Negotiated fares are outside the customer payment session.
     * The transporter owes the platform commission after the customer
     * accepts the negotiated bid. The commission rule is resolved from
     * the Administration Management Platform's active rules.
     *
     * Use the same transaction client so the agreement and booking
     * cannot become inconsistent.
     */
    const commission = await calculateCommission(
      Number(bid.amount),
      transporter.transporterTier,
      tx,
    );

    const agreement = await tx.negotiationAgreement.create({
      data: {
        marketplaceRequestId: requestId,
        marketplaceBidId: bid.id,
        customerId,
        transporterId: bid.transporterId,
        estimatedFare: request.estimatedFare ?? bid.amount,
        agreedFare: bid.amount,
        commissionRuleId: commission.rule?.id ?? null,
        commissionAmount: commission.commissionAmount,
        currency: commission.rule?.currency ?? "NGN",
        status: "COMMISSION_DUE",
        commissionStatus: "DUE",
        agreedAt: selectedAt,
      },
    });

    /*
     * Return all identifiers needed by realtime/admin consumers.
     */
    return {
      request: linkedRequest,
      bid: {
        ...bid,
        status: "SELECTED",
        selectedAt,
      },
      booking,
      agreement,
      vehicleId: vehicle.id,
      transporterId: bid.transporterId,
    };
  });

  /*
   * Publish marketplace events after the transaction commits.
   * This prevents realtime consumers from receiving an event for
   * a transaction that subsequently rolled back.
   */
  publishEvent("marketplace", {
    eventType: "BID_SELECTED",
    module: "FLEET_MARKETPLACE",
    entityType: "MARKETPLACE_BID",
    entityId: result.bid.id,
    actorId: customerId,
    data: {
      bidId: result.bid.id,
      requestId: result.request.id,
      transporterId: result.transporterId,
      vehicleId: result.vehicleId,
      amount: result.bid.amount,
      status: "SELECTED",
      bookingId: result.booking.id,
    },
  });

  publishEvent("marketplace", {
    eventType: "MARKETPLACE_REQUEST_AGREED",
    module: "FLEET_MARKETPLACE",
    entityType: "MARKETPLACE_REQUEST",
    entityId: result.request.id,
    actorId: customerId,
    data: {
      requestId: result.request.id,
      bidId: result.bid.id,
      bookingId: result.booking.id,
      status: result.request.status,
    },
  });

  publishEvent("booking", {
    eventType: "SHIPMENT_ASSIGNED",
    module: "LIVE_TRIPS",
    entityType: "BOOKING",
    entityId: result.booking.id,
    bookingId: result.booking.id,
    actorId: customerId,
    data: {
      bookingId: result.booking.id,
      customerId,
      transporterId: result.transporterId,
      vehicleId: result.vehicleId,
      status: result.booking.status,
      fare: result.booking.fare,
      marketplaceRequestId: result.request.id,
      marketplaceBidId: result.bid.id,
    },
  });

  publishEvent("vehicle", {
    eventType: "VEHICLE_AVAILABILITY_UPDATED",
    module: "FLEET_MARKETPLACE",
    entityType: "VEHICLE",
    entityId: result.vehicleId,
    actorId: customerId,
    data: {
      vehicleId: result.vehicleId,
      transporterId: result.transporterId,
      availabilityStatus: "ON_TRIP",
      bookingId: result.booking.id,
    },
  });

  return result;
}
