import { env } from "../config/env.js";

type PaystackInitializeInput = {
  reference: string;
  amountNaira: number;
  email: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
};

type PaystackInitializeResponse = {
  status: boolean;
  message?: string;
  data?: {
    authorization_url?: string;
    access_code?: string;
    reference?: string;
  };
};

type PaystackVerifyResponse = {
  status: boolean;
  message?: string;
  data?: {
    id: number;
    reference: string;
    amount: number;
    currency: string;
    status: string;
    gateway_response?: string;
    paid_at?: string | null;
  } | null;
};

async function paystackRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${env.PAYSTACK_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers ?? {}),
    },
  });

  const body = (await response.json()) as T;

  if (!response.ok) {
    throw new Error("Paystack API request failed");
  }

  return body;
}

export async function initializePaystackPayment(
  input: PaystackInitializeInput,
) {
  if (!Number.isFinite(input.amountNaira) || input.amountNaira <= 0) {
    throw new Error("Invalid Paystack payment amount");
  }

  const amountKobo = Math.round(input.amountNaira * 100);

  const response =
    await paystackRequest<PaystackInitializeResponse>(
      "/transaction/initialize",
      {
        method: "POST",
        body: JSON.stringify({
          amount: amountKobo,
          email: input.email,
          reference: input.reference,
          currency: "NGN",
          callback_url: input.callbackUrl,
          metadata: input.metadata,
        }),
      },
    );

  if (
    response.status !== true ||
    !response.data?.authorization_url ||
    !response.data.reference
  ) {
    throw new Error(
      response.message ?? "Paystack payment initialization failed",
    );
  }

  return {
    authorizationUrl: response.data.authorization_url,
    accessCode: response.data.access_code,
    reference: response.data.reference,
  };
}

export async function verifyPaystackTransaction(
  reference: string,
) {
  if (!reference.trim()) {
    throw new Error("Invalid Paystack transaction reference");
  }

  const response =
    await paystackRequest<PaystackVerifyResponse>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: "GET",
      },
    );

  if (response.status !== true || !response.data) {
    throw new Error(
      response.message ?? "Paystack transaction verification failed",
    );
  }

  return response.data;
}
