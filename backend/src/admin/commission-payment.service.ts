import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";
import {
  findFlutterwaveTransactionByReference,
  verifyFlutterwaveTransaction,
} from "../payments/flutterwave.service.js";

export async function listCommissionPayments(status?: string) {
  const payments = await prisma.commissionPayment.findMany({
    where: status
      ? {
          status: status as
            | "PENDING"
            | "PROCESSING"
            | "SUCCESS"
            | "FAILED"
            | "REJECTED"
            | "CANCELLED",
        }
      : undefined,
    include: {
      negotiationAgreement: {
        select: {
          id: true,
          agreedFare: true,
          commissionAmount: true,
          currency: true,
          status: true,
          commissionStatus: true,
          agreedAt: true,
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          transporter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      transporter: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      verifier: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return payments;
}

export async function getCommissionPaymentById(id: string) {
  return prisma.commissionPayment.findUnique({
    where: {
      id,
    },
    include: {
      negotiationAgreement: {
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          transporter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      transporter: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      verifier: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
}

export async function verifyCommissionPayment(
  paymentId: string,
  adminId: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.commissionPayment.findUnique({
      where: {
        id: paymentId,
      },
      include: {
        negotiationAgreement: true,
      },
    });

    if (!payment) {
      throw new Error("Commission payment not found");
    }

    if (payment.provider !== "BANK_TRANSFER") {
      throw new Error(
        "Only bank transfer commission payments can be manually verified",
      );
    }

    if (payment.status === "SUCCESS") {
      return payment;
    }

    if (payment.status !== "PENDING") {
      throw new Error("Commission payment is not awaiting verification");
    }

    const claimed = await tx.commissionPayment.updateMany({
      where: {
        id: paymentId,
        status: "PENDING",
      },
      data: {
        status: "SUCCESS",
        verifiedAt: new Date(),
        verifiedBy: adminId,
        rejectionReason: null,
      },
    });

    if (claimed.count !== 1) {
      throw new Error("Commission payment could not be verified");
    }

    await tx.negotiationAgreement.update({
      where: {
        id: payment.negotiationAgreementId,
      },
      data: {
        status: "COMMISSION_VERIFIED",
        commissionStatus: "VERIFIED",
        commissionVerifiedAt: new Date(),
        commissionVerifiedBy: adminId,
      },
    });

    return tx.commissionPayment.findUniqueOrThrow({
      where: {
        id: paymentId,
      },
      include: {
        negotiationAgreement: true,
      },
    });
  });

  publishEvent("admin", {
    eventType: "COMMISSION_PAYMENT_VERIFIED",
    module: "FINANCIAL_OPERATIONS",
    entityType: "COMMISSION_PAYMENT",
    entityId: result.id,
    actorId: adminId,
    data: {
      commissionPaymentId: result.id,
      negotiationAgreementId: result.negotiationAgreementId,
      transporterId: result.transporterId,
      amount: result.amount,
      currency: result.currency,
      provider: result.provider,
      status: result.status,
    },
  });

  return result;
}

export async function rejectCommissionPayment(
  paymentId: string,
  adminId: string,
  rejectionReason: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.commissionPayment.findUnique({
      where: {
        id: paymentId,
      },
      include: {
        negotiationAgreement: true,
      },
    });

    if (!payment) {
      throw new Error("Commission payment not found");
    }

    if (payment.provider !== "BANK_TRANSFER") {
      throw new Error(
        "Only bank transfer commission payments can be manually rejected",
      );
    }

    if (payment.status !== "PENDING") {
      throw new Error("Commission payment is not awaiting verification");
    }

    const claimed = await tx.commissionPayment.updateMany({
      where: {
        id: paymentId,
        status: "PENDING",
      },
      data: {
        status: "REJECTED",
        verifiedAt: null,
        verifiedBy: adminId,
        rejectionReason,
      },
    });

    if (claimed.count !== 1) {
      throw new Error("Commission payment could not be rejected");
    }

    await tx.negotiationAgreement.update({
      where: {
        id: payment.negotiationAgreementId,
      },
      data: {
        status: "COMMISSION_DUE",
        commissionStatus: "DUE",
        commissionVerifiedAt: null,
        commissionVerifiedBy: null,
      },
    });

    return tx.commissionPayment.findUniqueOrThrow({
      where: {
        id: paymentId,
      },
      include: {
        negotiationAgreement: true,
      },
    });
  });

  publishEvent("admin", {
    eventType: "COMMISSION_PAYMENT_REJECTED",
    module: "FINANCIAL_OPERATIONS",
    entityType: "COMMISSION_PAYMENT",
    entityId: result.id,
    actorId: adminId,
    data: {
      commissionPaymentId: result.id,
      negotiationAgreementId: result.negotiationAgreementId,
      transporterId: result.transporterId,
      amount: result.amount,
      currency: result.currency,
      provider: result.provider,
      status: result.status,
      rejectionReason: result.rejectionReason,
    },
  });

  return result;
}

export async function verifyFlutterwaveCommissionPayment(
  paymentId: string,
  adminId: string,
) {
  const payment = await prisma.commissionPayment.findUnique({
    where: {
      id: paymentId,
    },
  });

  if (!payment) {
    throw new Error("Commission payment not found");
  }

  if (payment.provider !== "FLUTTERWAVE") {
    throw new Error(
      "Only Flutterwave commission payments can be verified with Flutterwave",
    );
  }

  if (payment.status === "SUCCESS") {
    return getCommissionPaymentById(paymentId);
  }

  if (payment.status !== "PENDING" && payment.status !== "PROCESSING") {
    throw new Error("Commission payment is not awaiting verification");
  }

  let transactionId = payment.providerTransactionId;

  if (!transactionId) {
    const transaction = await findFlutterwaveTransactionByReference(
      payment.transactionReference,
    );

    transactionId = String(transaction.id);
  }

  if (!/^\d+$/.test(transactionId)) {
    throw new Error("Invalid Flutterwave transaction ID");
  }

  const verified = await verifyFlutterwaveTransaction(transactionId);

  if (verified.status.toLowerCase() !== "successful") {
    throw new Error("Flutterwave transaction is not successful");
  }

  if (verified.tx_ref !== payment.transactionReference) {
    throw new Error(
      "Flutterwave transaction reference does not match commission payment",
    );
  }

  const normalizeAmount = (value: string) => {
    if (!/^\d+(?:\.\d+)?$/.test(value)) {
      return null;
    }

    const [whole, fraction = ""] = value.split(".");
    return `${whole}.${fraction.padEnd(2, "0").slice(0, 2)}`;
  };

  const verifiedAmount = normalizeAmount(String(verified.amount).trim());
  const expectedAmount = normalizeAmount(payment.amount.toString().trim());

  if (
    verifiedAmount === null ||
    expectedAmount === null ||
    verifiedAmount !== expectedAmount
  ) {
    throw new Error(
      "Flutterwave transaction amount does not match commission payment",
    );
  }

  if (
    verified.currency.trim().toUpperCase() !==
    payment.currency.trim().toUpperCase()
  ) {
    throw new Error(
      "Flutterwave transaction currency does not match commission payment",
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.commissionPayment.updateMany({
      where: {
        id: payment.id,
        status: {
          in: ["PENDING", "PROCESSING"],
        },
      },
      data: {
        status: "SUCCESS",
        providerTransactionId: transactionId,
        verifiedAt: new Date(),
        verifiedBy: adminId,
        rejectionReason: null,
      },
    });

    if (claimed.count === 0) {
      const current = await tx.commissionPayment.findUnique({
        where: {
          id: payment.id,
        },
      });

      if (current?.status === "SUCCESS") {
        return current;
      }

      throw new Error("Commission payment could not be verified");
    }

    await tx.negotiationAgreement.update({
      where: {
        id: payment.negotiationAgreementId,
      },
      data: {
        status: "COMMISSION_VERIFIED",
        commissionStatus: "VERIFIED",
        commissionVerifiedAt: new Date(),
        commissionVerifiedBy: adminId,
      },
    });

    return tx.commissionPayment.findUniqueOrThrow({
      where: {
        id: payment.id,
      },
      include: {
        negotiationAgreement: true,
      },
    });
  });

  publishEvent("admin", {
    eventType: "COMMISSION_PAYMENT_VERIFIED",
    module: "FINANCIAL_OPERATIONS",
    entityType: "COMMISSION_PAYMENT",
    entityId: result.id,
    actorId: adminId,
    data: {
      commissionPaymentId: result.id,
      negotiationAgreementId: result.negotiationAgreementId,
      transporterId: result.transporterId,
      amount: result.amount,
      currency: result.currency,
      provider: result.provider,
      status: result.status,
      verificationMethod: "FLUTTERWAVE",
      providerTransactionId: transactionId,
    },
  });

  return result;
}
