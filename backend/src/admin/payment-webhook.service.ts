import { prisma } from "../config/prisma.js";

export async function getWebhookEvents(filters?: {
  provider?: string;
  processed?: boolean;
}) {
  return prisma.paymentWebhookEvent.findMany({
    where: {
      ...(filters?.provider
        ? { provider: filters.provider }
        : {}),

      ...(filters?.processed !== undefined
        ? { processed: filters.processed }
        : {}),
    },

    include: {
      payment: true,
    },

    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getWebhookEventById(
  id: string,
) {
  return prisma.paymentWebhookEvent.findUnique({
    where: {
      id,
    },

    include: {
      payment: true,
    },
  });
}

export async function getFailedWebhookEvents() {
  return prisma.paymentWebhookEvent.findMany({
    where: {
      processed: false,
    },

    include: {
      payment: true,
    },

    orderBy: {
      createdAt: "desc",
    },
  });
}
