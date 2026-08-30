import { prisma } from "../config/prisma.js";

export async function listTransporters(options: {
  search?: string;
  status?: "PENDING" | "ACTIVE" | "SUSPENDED" | "BLOCKED";
  verificationStatus?: "PENDING" | "APPROVED" | "REJECTED";
  page?: number;
  limit?: number;
}) {
  const page = Math.max(options.page ?? 1, 1);
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const search = options.search?.trim();

  const where = {
    role: "TRANSPORTER" as const,
    ...(options.status ? { status: options.status } : {}),
    ...(options.verificationStatus
      ? {
          transporterProfile: {
            verificationStatus: options.verificationStatus,
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
            {
              transporterProfile: {
                companyName: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            },
          ],
        }
      : {}),
  };

  const [transporters, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        transporterTier: true,
        profilePhoto: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        transporterProfile: {
          select: {
            userId: true,
            companyName: true,
            businessRegistrationNumber: true,
            address: true,
            city: true,
            state: true,
            country: true,
            verificationStatus: true,
            tier2Approved: true,
            rating: true,
            totalTrips: true,
            totalEarnings: true,
          },
        },
        _count: {
          select: {
            transporterBookings: true,
            vehicles: true,
            marketplaceBids: true,
            supportTickets: true,
            disputesAsTransporter: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    transporters,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getTransporterManagementRecord(id: string) {
  return prisma.user.findFirst({
    where: {
      id,
      role: "TRANSPORTER",
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      transporterTier: true,
      profilePhoto: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      transporterProfile: {
        select: {
          userId: true,
          companyName: true,
          businessRegistrationNumber: true,
          address: true,
          city: true,
          state: true,
          country: true,
          verificationStatus: true,
          tier2Approved: true,
          rating: true,
          totalTrips: true,
          totalEarnings: true,
        },
      },
      vehicles: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          registrationNumber: true,
          make: true,
          model: true,
          year: true,
          vehicleType: true,
          vehicleClass: true,
          verificationStatus: true,
          availabilityStatus: true,
          createdAt: true,
        },
      },
      transporterBookings: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          customerId: true,
          vehicleId: true,
          pickupLocation: true,
          destination: true,
          status: true,
          fare: true,
          paymentStatus: true,
          scheduledDate: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });
}

export async function changeTransporterStatus(
  administratorId: string,
  transporterId: string,
  status: "ACTIVE" | "SUSPENDED" | "BLOCKED",
) {
  return prisma.$transaction(async (tx) => {
    const transporter = await tx.user.findFirst({
      where: {
        id: transporterId,
        role: "TRANSPORTER",
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!transporter) {
      throw new Error("Transporter not found");
    }

    const updated = await tx.user.update({
      where: { id: transporterId },
      data: { status },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    await tx.auditLog.create({
      data: {
        administratorId,
        affectedUserId: transporterId,
        action: `TRANSPORTER_STATUS_${status}`,
        previousValue: { status: transporter.status },
        newValue: { status },
      },
    });

    return updated;
  });
}

export async function changeTransporterVerification(
  administratorId: string,
  transporterId: string,
  verificationStatus: "APPROVED" | "REJECTED",
) {
  return prisma.$transaction(async (tx) => {
    const transporter = await tx.user.findFirst({
      where: {
        id: transporterId,
        role: "TRANSPORTER",
      },
      select: {
        id: true,
        transporterProfile: {
          select: {
            verificationStatus: true,
          },
        },
      },
    });

    if (!transporter?.transporterProfile) {
      throw new Error("Transporter profile not found");
    }

    const updated = await tx.transporterProfile.update({
      where: { userId: transporterId },
      data: { verificationStatus },
    });

    await tx.auditLog.create({
      data: {
        administratorId,
        affectedUserId: transporterId,
        action: `TRANSPORTER_VERIFICATION_${verificationStatus}`,
        previousValue: {
          verificationStatus:
            transporter.transporterProfile.verificationStatus,
        },
        newValue: { verificationStatus },
      },
    });

    return updated;
  });
}
