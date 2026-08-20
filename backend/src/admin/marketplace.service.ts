import { prisma } from "../config/prisma.js";

function serializeDecimal(value: unknown) {
  if (value === null || value === undefined) return value;
  return typeof value === "object" && value !== null && "toString" in value
    ? Number(value)
    : value;
}

function serializeRequest(request: any) {
  return {
    id: request.id,
    customerId: request.customerId,
    bookingId: request.bookingId,
    cargoDescription: request.cargoDescription,
    truckCategory: request.truckCategory,
    cargoCategory: request.cargoCategory,
    cargoWeight: serializeDecimal(request.cargoWeight),
    pickupLocation: request.pickupLocation,
    destination: request.destination,
    pickupLatitude: serializeDecimal(request.pickupLatitude),
    pickupLongitude: serializeDecimal(request.pickupLongitude),
    destinationLatitude: serializeDecimal(request.destinationLatitude),
    destinationLongitude: serializeDecimal(request.destinationLongitude),
    scheduledDate: request.scheduledDate,
    estimatedFare: serializeDecimal(request.estimatedFare),
    status: request.status,
    agreedBidId: request.agreedBidId,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    closedAt: request.closedAt,
    customer: request.customer
      ? {
          id: request.customer.id,
          firstName: request.customer.firstName,
          lastName: request.customer.lastName,
          email: request.customer.email,
          phone: request.customer.phone,
          status: request.customer.status,
        }
      : null,
    booking: request.booking
      ? {
          id: request.booking.id,
          status: request.booking.status,
          fare: serializeDecimal(request.booking.fare),
          transporterId: request.booking.transporterId,
          vehicleId: request.booking.vehicleId,
          createdAt: request.booking.createdAt,
        }
      : null,
    bids: request.bids?.map(serializeBid) ?? [],
    bidCount: request._count?.bids ?? request.bids?.length ?? 0,
  };
}

function serializeBid(bid: any) {
  return {
    id: bid.id,
    requestId: bid.requestId,
    transporterId: bid.transporterId,
    vehicleId: bid.vehicleId,
    amount: serializeDecimal(bid.amount),
    message: bid.message,
    status: bid.status,
    expiresAt: bid.expiresAt,
    selectedAt: bid.selectedAt,
    createdAt: bid.createdAt,
    updatedAt: bid.updatedAt,
    transporter: bid.transporter
      ? {
          id: bid.transporter.id,
          firstName: bid.transporter.firstName,
          lastName: bid.transporter.lastName,
          email: bid.transporter.email,
          phone: bid.transporter.phone,
          status: bid.transporter.status,
          transporterTier: bid.transporter.transporterTier,
          verificationStatus:
            bid.transporter.transporterProfile?.verificationStatus ?? null,
          rating: bid.transporter.transporterProfile?.rating ?? null,
          totalTrips: bid.transporter.transporterProfile?.totalTrips ?? 0,
        }
      : null,
    vehicle: bid.vehicle
      ? {
          id: bid.vehicle.id,
          registrationNumber: bid.vehicle.registrationNumber,
          vehicleType: bid.vehicle.vehicleType,
          vehicleClass: bid.vehicle.vehicleClass,
          make: bid.vehicle.make,
          model: bid.vehicle.model,
          verificationStatus: bid.vehicle.verificationStatus,
          availabilityStatus: bid.vehicle.availabilityStatus,
          currentLatitude: serializeDecimal(bid.vehicle.currentLatitude),
          currentLongitude: serializeDecimal(bid.vehicle.currentLongitude),
        }
      : null,
  };
}

export async function getAdminMarketplaceRequests(options: {
  search?: string;
  status?: string;
  page: number;
  limit: number;
}) {
  const { search, status, page, limit } = options;

  const where: any = {};

  if (status) {
    where.status = status;
  }

  if (search?.trim()) {
    const query = search.trim();

    where.OR = [
      { pickupLocation: { contains: query, mode: "insensitive" } },
      { destination: { contains: query, mode: "insensitive" } },
      { cargoDescription: { contains: query, mode: "insensitive" } },
      {
        customer: {
          OR: [
            { firstName: { contains: query, mode: "insensitive" } },
            { lastName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { phone: { contains: query, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  const [total, requests] = await prisma.$transaction([
    prisma.marketplaceRequest.count({ where }),
    prisma.marketplaceRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
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
        booking: {
          select: {
            id: true,
            status: true,
            fare: true,
            transporterId: true,
            vehicleId: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            bids: true,
          },
        },
      },
    }),
  ]);

  return {
    requests: requests.map(serializeRequest),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getAdminMarketplaceRequest(id: string) {
  const request = await prisma.marketplaceRequest.findUnique({
    where: { id },
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
      booking: {
        select: {
          id: true,
          status: true,
          fare: true,
          transporterId: true,
          vehicleId: true,
          createdAt: true,
        },
      },
      bids: {
        orderBy: { createdAt: "asc" },
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
          updatedAt: true,
          transporter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              status: true,
              transporterTier: true,
              transporterProfile: {
                select: {
                  verificationStatus: true,
                  rating: true,
                  totalTrips: true,
                },
              },
            },
          },
          vehicle: {
            select: {
              id: true,
              registrationNumber: true,
              vehicleType: true,
              vehicleClass: true,
              make: true,
              model: true,
              verificationStatus: true,
              availabilityStatus: true,
              currentLatitude: true,
              currentLongitude: true,
            },
          },
        },
      },
      _count: {
        select: {
          bids: true,
        },
      },
    },
  });

  return request ? serializeRequest(request) : null;
}

export async function getAdminMarketplaceBids(options: {
  search?: string;
  status?: string;
  page: number;
  limit: number;
}) {
  const { search, status, page, limit } = options;

  const where: any = {};

  if (status) {
    where.status = status;
  }

  if (search?.trim()) {
    const query = search.trim();

    where.OR = [
      { id: { contains: query, mode: "insensitive" } },
      {
        transporter: {
          OR: [
            { firstName: { contains: query, mode: "insensitive" } },
            { lastName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        },
      },
      {
        vehicle: {
          registrationNumber: {
            contains: query,
            mode: "insensitive",
          },
        },
      },
    ];
  }

  const [total, bids] = await prisma.$transaction([
    prisma.marketplaceBid.count({ where }),
    prisma.marketplaceBid.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
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
        updatedAt: true,
        transporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            status: true,
            transporterTier: true,
            transporterProfile: {
              select: {
                verificationStatus: true,
                rating: true,
                totalTrips: true,
              },
            },
          },
        },
        vehicle: {
          select: {
            id: true,
            registrationNumber: true,
            vehicleType: true,
            vehicleClass: true,
            make: true,
            model: true,
            verificationStatus: true,
            availabilityStatus: true,
            currentLatitude: true,
            currentLongitude: true,
          },
        },
      },
    }),
  ]);

  return {
    bids: bids.map(serializeBid),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getAdminMarketplaceBid(id: string) {
  const bid = await prisma.marketplaceBid.findUnique({
    where: { id },
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
      updatedAt: true,
      request: {
        select: {
          id: true,
          customerId: true,
          pickupLocation: true,
          destination: true,
          truckCategory: true,
          cargoCategory: true,
          cargoWeight: true,
          estimatedFare: true,
          status: true,
          scheduledDate: true,
          agreedBidId: true,
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
          transporterProfile: {
            select: {
              verificationStatus: true,
              rating: true,
              totalTrips: true,
            },
          },
        },
      },
      vehicle: {
        select: {
          id: true,
          registrationNumber: true,
          vehicleType: true,
          vehicleClass: true,
          make: true,
          model: true,
          verificationStatus: true,
          availabilityStatus: true,
          currentLatitude: true,
          currentLongitude: true,
        },
      },
    },
  });

  return bid ? serializeBid(bid) : null;
}

export async function getAdminMarketplaceSummary() {
  const [
    openRequests,
    agreedRequests,
    biddingClosedRequests,
    cancelledRequests,
    expiredRequests,
    pendingBids,
    selectedBids,
    vehicles,
  ] = await prisma.$transaction([
    prisma.marketplaceRequest.count({
      where: { status: "OPEN" },
    }),
    prisma.marketplaceRequest.count({
      where: { status: "AGREED" },
    }),
    prisma.marketplaceRequest.count({
      where: { status: "BIDDING_CLOSED" },
    }),
    prisma.marketplaceRequest.count({
      where: { status: "CANCELLED" },
    }),
    prisma.marketplaceRequest.count({
      where: { status: "EXPIRED" },
    }),
    prisma.marketplaceBid.count({
      where: { status: "PENDING" },
    }),
    prisma.marketplaceBid.count({
      where: { status: "SELECTED" },
    }),
    prisma.vehicle.count({
      where: {
        availabilityStatus: "AVAILABLE",
        verificationStatus: "APPROVED",
      },
    }),
  ]);

  return {
    openRequests,
    agreedRequests,
    closedRequests:
      biddingClosedRequests +
      cancelledRequests +
      expiredRequests,
    pendingBids,
    selectedBids,
    eligibleVehicles: vehicles,
  };
}
