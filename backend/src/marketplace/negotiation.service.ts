import { prisma } from "../config/prisma.js";
import { calculateCommission } from "../settlements/commission.service.js";
import { publishAdminEvent } from "../realtime/realtime.service.js";

export async function createNegotiationAgreement(
  requestId: string,
  bidId: string,
  customerId: string,
) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.marketplaceRequest.findUnique({
      where: { id: requestId },
      include: {
        bids: true,
      },
    });

    if (!request) {
      throw new Error("Marketplace request not found");
    }

    if (request.customerId !== customerId) {
      throw new Error("Access denied");
    }

    if (request.status !== "OPEN") {
      throw new Error("Marketplace request is no longer open");
    }

    const bid = request.bids.find(
      (item) => item.id === bidId && item.status === "PENDING",
    );

    if (!bid) {
      throw new Error("Valid pending bid not found");
    }

    if (bid.expiresAt && bid.expiresAt <= new Date()) {
      throw new Error("Bid has expired");
    }

    const existing = await tx.negotiationAgreement.findUnique({
      where: { marketplaceRequestId: requestId },
    });

    if (existing) {
      throw new Error("Negotiation agreement already exists");
    }

    const transporter = await tx.user.findUnique({
      where: { id: bid.transporterId },
      select: {
        id: true,
        role: true,
        status: true,
        transporterTier: true,
      },
    });

    if (
      !transporter ||
      transporter.role !== "TRANSPORTER" ||
      transporter.status !== "ACTIVE"
    ) {
      throw new Error("Transporter is not eligible");
    }

    const commission = await calculateCommission(
      Number(bid.amount),
      transporter.transporterTier,
    );

    const agreement = await tx.negotiationAgreement.create({
      data: {
        marketplaceRequestId: requestId,
        marketplaceBidId: bidId,
        customerId,
        transporterId: bid.transporterId,
        estimatedFare: request.estimatedFare ?? bid.amount,
        agreedFare: bid.amount,
        commissionRuleId: commission.rule?.id ?? null,
        commissionAmount: commission.commissionAmount,
        currency: commission.rule?.currency ?? "NGN",
        status: "COMMISSION_DUE",
        commissionStatus: "DUE",
        agreedAt: new Date(),
      },
    });

    await tx.marketplaceRequest.update({
      where: { id: requestId },
      data: {
        status: "AGREED",
        agreedBidId: bidId,
      },
    });

    await tx.marketplaceBid.updateMany({
      where: {
        requestId,
        id: { not: bidId },
        status: "PENDING",
      },
      data: {
        status: "REJECTED",
      },
    });

    await tx.marketplaceBid.update({
      where: { id: bidId },
      data: {
        status: "SELECTED",
        selectedAt: new Date(),
      },
    });

    return agreement;
  });
}
