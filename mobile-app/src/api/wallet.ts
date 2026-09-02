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
  walletId?: string;
  amount: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  status: string;
  createdAt: string;
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

export async function requestWithdrawal(input: {
  amount: number;
  transporterId?: string;
  accountNumber?: string;
  bankCode?: string;
}): Promise<Withdrawal> {
  const response = await apiClient.post<ApiResponse<Withdrawal>>(
    "/wallet/withdraw",
    input,
  );

  return response.data.data;
}
