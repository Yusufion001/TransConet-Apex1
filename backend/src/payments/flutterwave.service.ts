import { env } from "../config/env.js";

type FlutterwaveCustomer = {
  email?: string | null;
  name: string;
  phonenumber?: string | null;
};

type FlutterwaveInitializeInput = {
  txRef: string;
  amount: string;
  currency: string;
  customer: FlutterwaveCustomer;
  redirectUrl?: string;
  title?: string;
  description?: string;
};

type FlutterwaveInitializeResponse = {
  status: string;
  message?: string;
  data?: {
    link?: string;
  };
};

type FlutterwaveTransaction = {
  id: number;
  tx_ref: string;
  amount: number;
  charged_amount?: number;
  currency: string;
  status: string;
  flw_ref?: string;
};

type FlutterwaveVerifyResponse = {
  status: string;
  message?: string;
  data?: FlutterwaveTransaction | null;
};

async function flutterwaveRequest<T>(
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

  const body = (await response.json()) as T;

  if (!response.ok) {
    throw new Error("Flutterwave API request failed");
  }

  return body;
}

export async function initializeFlutterwavePayment(
  input: FlutterwaveInitializeInput,
) {
  const response =
    await flutterwaveRequest<FlutterwaveInitializeResponse>("/payments", {
      method: "POST",
      body: JSON.stringify({
        tx_ref: input.txRef,
        amount: input.amount,
        currency: input.currency,
        redirect_url: input.redirectUrl ?? env.FLW_REDIRECT_URL,
        customer: {
          email: input.customer.email ?? undefined,
          name: input.customer.name,
          phonenumber: input.customer.phonenumber ?? undefined,
        },
        customizations: {
          title: input.title ?? "TransConet Shipment Payment",
          description:
            input.description ?? "Payment for TransConet shipment",
        },
      }),
    });

  if (
    response.status !== "success" ||
    !response.data?.link
  ) {
    throw new Error("Flutterwave payment initialization failed");
  }

  return {
    link: response.data.link,
  };
}

export async function verifyFlutterwaveTransaction(
  transactionId: string,
) {
  if (!/^\d+$/.test(transactionId)) {
    throw new Error("Invalid Flutterwave transaction ID");
  }

  const response =
    await flutterwaveRequest<FlutterwaveVerifyResponse>(
      `/transactions/${encodeURIComponent(transactionId)}/verify`,
      {
        method: "GET",
      },
    );

  if (
    response.status !== "success" ||
    !response.data
  ) {
    throw new Error("Flutterwave transaction verification failed");
  }

  return response.data;
}
