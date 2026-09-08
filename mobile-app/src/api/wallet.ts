import { apiClient } from "./client";

export type WalletTransaction = {
  id: string;
  walletId: string;
  bookingId: string | null;
  amount: string;
  transactionType: string;
  description: string | null;
  createdAt: string;
};

export type Withdrawal = {
  id: string;
  walletId: string;
  amount: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  status: string;
  createdAt: string;
};

export type WithdrawalAccount = {
  id: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  status: string;
  verifiedAt: string | null;
  securityCooldownUntil: string | null;
  isDefault: boolean;
  createdAt: string;
};

export type WithdrawalSecurityPurpose =
  | "ADD_WITHDRAWAL_ACCOUNT"
  | "CHANGE_WITHDRAWAL_ACCOUNT";

export type WithdrawalSecurityChallenge = {
  challengeId: string;
  purpose: WithdrawalSecurityPurpose;
  expiresAt: string;
};

export type Wallet = {
  id: string;
  transporterId: string;
  availableBalance: string;
  pendingBalance: string;
  createdAt: string;
  updatedAt: string;
  transactions?: WalletTransaction[];
  withdrawals?: Withdrawal[];
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export async function getTransporterWallet(
  transporterId: string,
): Promise<Wallet> {
  const response = await apiClient.get<ApiResponse<Wallet>>(
    `/wallet/${transporterId}`,
  );

  return response.data.data;
}

export async function createTransporterWallet(
  transporterId: string,
): Promise<Wallet> {
  const response = await apiClient.post<ApiResponse<Wallet>>(
    "/wallet",
    { transporterId },
  );

  return response.data.data;
}

export async function getWithdrawalAccounts(
  transporterId: string,
): Promise<WithdrawalAccount[]> {
  const response = await apiClient.get<
    ApiResponse<WithdrawalAccount[]>
  >(`/wallet/accounts/${transporterId}`);

  return response.data.data;
}

export async function createWithdrawalAccountChallenge(
  purpose: WithdrawalSecurityPurpose,
): Promise<WithdrawalSecurityChallenge> {
  const response = await apiClient.post<
    ApiResponse<WithdrawalSecurityChallenge>
  >("/wallet/accounts/challenge", {
    purpose,
  });

  return response.data.data;
}

export async function createWithdrawalAccount(input: {
  challengeId: string;
  pin: string;
  bankCode: string;
  accountNumber: string;
}): Promise<WithdrawalAccount> {
  const response = await apiClient.post<
    ApiResponse<WithdrawalAccount>
  >("/wallet/accounts", {
    challengeId: input.challengeId,
    pin: input.pin,
    bankCode: input.bankCode,
    accountNumber: input.accountNumber,
  });

  return response.data.data;
}

export async function requestWithdrawal(input: {
  amount: number;
  withdrawalAccountId: string;
  idempotencyKey: string;
}): Promise<Withdrawal> {
  const response = await apiClient.post<ApiResponse<Withdrawal>>(
    "/wallet/withdraw",
    {
      amount: input.amount,
      withdrawalAccountId: input.withdrawalAccountId,
    },
    {
      headers: {
        "X-Idempotency-Key": input.idempotencyKey,
      },
    },
  );

  return response.data.data;
}
