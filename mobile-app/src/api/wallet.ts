import { apiClient } from "./client";

export type Wallet = {
  id: string;
  transporterId: string;
  balance: string | number;
  availableBalance?: string | number;
  pendingBalance?: string | number;
  totalEarned?: string | number;
  currency?: string;
  status?: string;
};

export type Withdrawal = {
  id: string;
  amount: string | number;
  status: string;
  createdAt: string;
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
