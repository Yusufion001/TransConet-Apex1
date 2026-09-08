import { env } from "../config/env.js";

type FlutterwaveAccountResolveResponse = {
  status: string;
  message?: string;
  data?: {
    account_number?: string;
    account_name?: string;
    bank_code?: string;
    bank_name?: string;
    response_code?: string;
    [key: string]: unknown;
  } | null;
};

async function flutterwaveAccountRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${env.FLW_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${env.FLW_SECRET_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers ?? {}),
    },
  });

  let body: T;

  try {
    body = (await response.json()) as T;
  } catch {
    throw new Error("Flutterwave returned an invalid response");
  }

  if (!response.ok) {
    throw new Error("Flutterwave account verification request failed");
  }

  return body;
}

export async function resolveFlutterwaveBankAccount(input: {
  accountNumber: string;
  bankCode: string;
}) {
  const accountNumber = input.accountNumber.trim();
  const bankCode = input.bankCode.trim();

  if (!/^\d{10}$/.test(accountNumber)) {
    throw new Error("Account number must be exactly 10 digits");
  }

  if (!/^\d{3}$/.test(bankCode)) {
    throw new Error("Invalid Nigerian bank code");
  }

  const response =
    await flutterwaveAccountRequest<FlutterwaveAccountResolveResponse>(
      "/accounts/resolve",
      {
        method: "POST",
        body: JSON.stringify({
          account_number: accountNumber,
          account_bank: bankCode,
        }),
      },
    );

  if (
    response.status !== "success" ||
    !response.data?.account_name
  ) {
    throw new Error(
      response.message || "Unable to verify the bank account",
    );
  }

  return {
    accountName: response.data.account_name.trim(),
    bankCode,
    bankName: response.data.bank_name?.trim() || "",
    provider: "FLUTTERWAVE",
  };
}
