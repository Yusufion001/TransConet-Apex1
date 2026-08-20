import { prisma } from "../config/prisma.js";

export async function listCustomers(options: {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(options.page ?? 1, 1);
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const search = options.search?.trim();

  const where = {
    role: "CUSTOMER" as const,
    ...(options.status ? { status: options.status as any } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [customers, total] = await Promise.all([
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
        profilePhoto: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        customerProfile: {
          select: {
            userId: true,
            city: true,
            state: true,
            country: true,
            verificationStatus: true,
            rating: true,
            totalBookings: true,
          },
        },
        _count: {
          select: {
            customerBookings: true,
            payments: true,
            supportTickets: true,
            disputesAsCustomer: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    customers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getCustomerManagementRecord(id: string) {
  return prisma.user.findFirst({
    where: {
      id,
      role: "CUSTOMER",
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      profilePhoto: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      customerProfile: {
        select: {
          userId: true,
          city: true,
          state: true,
          country: true,
          verificationStatus: true,
          rating: true,
          totalBookings: true,
        },
      },
      customerBookings: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          pickupLocation: true,
          destination: true,
          status: true,
          fare: true,
          paymentStatus: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });
}

export async function getCustomerBookings(id: string) {
  return prisma.booking.findMany({
    where: { customerId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      transporterId: true,
      vehicleId: true,
      cargoDescription: true,
      truckCategory: true,
      estimatedFare: true,
      pickupLocation: true,
      destination: true,
      status: true,
      fare: true,
      paymentStatus: true,
      scheduledDate: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function changeCustomerStatus(
  administratorId: string,
  customerId: string,
  status: "ACTIVE" | "SUSPENDED" | "BLOCKED",
) {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.user.findFirst({
      where: {
        id: customerId,
        role: "CUSTOMER",
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!customer) {
      throw new Error("Customer not found");
    }

    const updated = await tx.user.update({
      where: { id: customerId },
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
        affectedUserId: customerId,
        action: `CUSTOMER_STATUS_${status}`,
        previousValue: { status: customer.status },
        newValue: { status },
      },
    });

    return updated;
  });
}
