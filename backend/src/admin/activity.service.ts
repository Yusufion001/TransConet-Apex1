import { prisma } from "../config/prisma.js";

export async function getAdminActivity(options: {
  module?: string;
  eventType?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(options.page ?? 1, 1);
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);

  const where = {
    ...(options.module ? { module: options.module as any } : {}),
    ...(options.eventType ? { eventType: options.eventType } : {}),
  };

  const [activities, total] = await Promise.all([
    prisma.adminActivity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.adminActivity.count({ where }),
  ]);

  return {
    activities,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
