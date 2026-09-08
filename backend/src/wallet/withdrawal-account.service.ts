import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import {
  resolveFlutterwaveBankAccount,
} from "./flutterwave-account.service.js";
import {
  encryptAccountNumber,
  fingerprintAccountNumber,
  accountNumberLast4,
} from "./wallet-crypto.js";
import {
  verifyWithdrawalSecurityChallenge,
} from "./withdrawal-security.service.js";

function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function namesMatch(
  providerName: string,
  expectedName: string,
): boolean {
  return normalizeName(providerName) === normalizeName(expectedName);
}

async function getVerifiedIdentityName(
  tx: typeof prisma,
  userId: string,
) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      status: true,
      firstName: true,
      lastName: true,
      phoneVerifiedAt: true,
      transporterProfile: {
        select: {
          companyName: true,
          transporterType: true,
          verificationStatus: true,
        },
      },
      verifications: {
        where: {
          type: {
            in: ["NIN", "DRIVERS_LICENSE"],
          },
          providerStatus: "SUCCESS",
          adminStatus: "APPROVED",
          adminApproved: true,
        },
        orderBy: {
          verifiedAt: "desc",
        },
        take: 1,
        select: {
          id: true,
          providerResponse: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.role !== "TRANSPORTER") {
    throw new Error("Only transporters can manage withdrawal accounts");
  }

  if (user.status !== "ACTIVE") {
    throw new Error("Transporter account is not active");
  }

  if (!user.phoneVerifiedAt) {
    throw new Error(
      "Your phone number must be verified before managing withdrawal accounts",
    );
  }

  const identityVerification = user.verifications[0];

  if (!identityVerification) {
    throw new Error(
      "An approved identity verification is required before adding a withdrawal account",
    );
  }

  const profile = user.transporterProfile;

  if (!profile) {
    throw new Error("Transporter profile not found");
  }

  if (
    profile.transporterType === "BUSINESS" &&
    profile.verificationStatus === "APPROVED" &&
    profile.companyName
  ) {
    return {
      user,
      expectedName: profile.companyName,
      identityType: "BUSINESS" as const,
      identityVerificationId: identityVerification.id,
    };
  }

  const expectedName =
    `${user.firstName} ${user.lastName}`.trim();

  if (!expectedName) {
    throw new Error(
      "Verified transporter name is unavailable",
    );
  }

  return {
    user,
    expectedName,
    identityType: "INDIVIDUAL" as const,
    identityVerificationId: identityVerification.id,
  };
}

export async function createVerifiedWithdrawalAccount(input: {
  userId: string;
  challengeId: string;
  pin: string;
  bankCode: string;
  accountNumber: string;
}) {
  const identity = await getVerifiedIdentityName(
    prisma,
    input.userId,
  );

  const security = await verifyWithdrawalSecurityChallenge(
    input.userId,
    input.challengeId,
    input.pin,
  );

  const resolved = await resolveFlutterwaveBankAccount({
    accountNumber: input.accountNumber,
    bankCode: input.bankCode,
  });

  if (
    !namesMatch(
      resolved.accountName,
      identity.expectedName,
    )
  ) {
    throw new Error(
      `Bank account name does not match the verified ${identity.identityType.toLowerCase()} identity`,
    );
  }

  const encryptedAccountNumber =
    encryptAccountNumber(input.accountNumber);

  const fingerprint =
    fingerprintAccountNumber(input.accountNumber);

  const last4 =
    accountNumberLast4(input.accountNumber);

  const cooldownHours =
    env.WALLET_ACCOUNT_CHANGE_COOLDOWN_HOURS;

  const securityCooldownUntil = new Date(
    Date.now() + cooldownHours * 60 * 60 * 1000,
  );

  const result = await prisma.$transaction(
    async (tx) => {
      /*
       * Serialize all withdrawal-account changes for this
       * transporter. This prevents concurrent ADD/CHANGE
       * requests from racing on the default account.
       */
      await tx.$queryRaw`
        SELECT "id"
        FROM "User"
        WHERE "id" = ${input.userId}
        FOR UPDATE
      `;

      const existing =
        await tx.withdrawalAccount.findUnique({
          where: {
            transporterId_accountNumberFingerprint: {
              transporterId: input.userId,
              accountNumberFingerprint: fingerprint,
            },
          },
          select: {
            id: true,
            status: true,
          },
        });

      if (existing) {
        if (existing.status === "VERIFIED") {
          throw new Error(
            "This bank account is already registered",
          );
        }

        if (existing.status === "SUSPENDED") {
          throw new Error(
            "This bank account is suspended and cannot be reused",
          );
        }
      }

      const defaultAccount =
        await tx.withdrawalAccount.findFirst({
          where: {
            transporterId: input.userId,
            status: "VERIFIED",
            isDefault: true,
          },
          select: {
            id: true,
          },
        });

      const isFirstAccount = !defaultAccount;

      /*
       * The OTP purpose is part of the security boundary.
       * An ADD challenge can never perform a CHANGE, and
       * a CHANGE challenge can never perform an initial ADD.
       */
      if (
        security.purpose === "ADD_WITHDRAWAL_ACCOUNT" &&
        !isFirstAccount &&
        defaultAccount
      ) {
        /*
         * ADD is allowed to create an additional verified
         * account, but it must not silently replace the
         * existing default destination.
         */
      }

      if (
        security.purpose === "CHANGE_WITHDRAWAL_ACCOUNT" &&
        isFirstAccount
      ) {
        throw new Error(
          "A withdrawal account must already exist before it can be changed",
        );
      }

      const isChange =
        security.purpose === "CHANGE_WITHDRAWAL_ACCOUNT";

      if (
        security.purpose !== "ADD_WITHDRAWAL_ACCOUNT" &&
        security.purpose !== "CHANGE_WITHDRAWAL_ACCOUNT"
      ) {
        throw new Error("Invalid withdrawal account security purpose");
      }

      if (isChange && defaultAccount) {
        await tx.withdrawalAccount.update({
          where: {
            id: defaultAccount.id,
          },
          data: {
            isDefault: false,
          },
        });
      }

      const account =
        await tx.withdrawalAccount.create({
          data: {
            transporterId: input.userId,
            bankCode: resolved.bankCode,
            bankName: resolved.bankName,
            accountNumberEncrypted:
              encryptedAccountNumber,
            accountNumberFingerprint:
              fingerprint,
            accountNumberLast4: last4,
            accountName: resolved.accountName,
            status: "VERIFIED",
            provider: resolved.provider,
            verifiedAt: new Date(),

            /*
             * The first account is immediately usable.
             * A changed destination enters a security cooldown.
             * Additional ADD accounts remain non-default.
             */
            securityCooldownUntil:
              isChange
                ? securityCooldownUntil
                : null,

            isDefault:
              isFirstAccount || isChange,
          },
        });

      await tx.auditLog.create({
        data: {
          administratorId: input.userId,
          action: isChange
            ? "WITHDRAWAL_ACCOUNT_CHANGED"
            : "WITHDRAWAL_ACCOUNT_ADDED",
          affectedUserId: input.userId,
          newValue: {
            withdrawalAccountId: account.id,
            bankCode: account.bankCode,
            accountNumberLast4:
              account.accountNumberLast4,
            status: account.status,
            provider: account.provider,
            identityType: identity.identityType,
            identityVerificationId:
              identity.identityVerificationId,
            securityPurpose: security.purpose,
            securityCooldownUntil:
              account.securityCooldownUntil
                ?.toISOString() ?? null,
            isDefault: account.isDefault,
          },
        },
      });

      return account;
    },
  );

  return {
    id: result.id,
    bankCode: result.bankCode,
    bankName: result.bankName,
    accountNumber:
      `******${result.accountNumberLast4}`,
    accountName: result.accountName,
    status: result.status,
    verifiedAt:
      result.verifiedAt?.toISOString() ?? null,
    securityCooldownUntil:
      result.securityCooldownUntil?.toISOString() ?? null,
    isDefault: result.isDefault,
  };
}

export async function getWithdrawalAccounts(
  transporterId: string,
) {
  const accounts =
    await prisma.withdrawalAccount.findMany({
      where: {
        transporterId,
      },
      orderBy: [
        {
          isDefault: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      select: {
        id: true,
        bankCode: true,
        bankName: true,
        accountNumberLast4: true,
        accountName: true,
        status: true,
        verifiedAt: true,
        securityCooldownUntil: true,
        isDefault: true,
        createdAt: true,
      },
    });

  return accounts.map((account) => ({
    id: account.id,
    bankCode: account.bankCode,
    bankName: account.bankName,
    accountNumber: `******${account.accountNumberLast4}`,
    accountName: account.accountName,
    status: account.status,
    verifiedAt: account.verifiedAt?.toISOString() ?? null,
    securityCooldownUntil:
      account.securityCooldownUntil?.toISOString() ?? null,
    isDefault: account.isDefault,
    createdAt: account.createdAt.toISOString(),
  }));
}
