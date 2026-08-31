import { env } from "../config/env.js";

type TermiiSendOtpResponse = {
  pinId?: string;
  messageId?: string;
  to?: string;
  status?: string;
  message?: string;
};

type TermiiVerifyOtpResponse = {
  pinId?: string;
  msisdn?: string;
  verified?: boolean;
  status?: string;
  message?: string;
};

function normalizePhoneNumber(phone: string): string {
  const value = phone.trim().replace(/[\s\-().]/g, "");

  if (value.startsWith("+")) {
    return value.slice(1);
  }

  if (value.startsWith("0")) {
    return `234${value.slice(1)}`;
  }

  return value;
}

async function termiiRequest<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(
    `${env.TERMII_BASE_URL.replace(/\/$/, "")}${path}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: env.TERMII_API_KEY,
        ...body,
      }),
    },
  );

  const data = (await response.json().catch(() => ({}))) as T & {
    message?: string;
  };

  if (!response.ok) {
    throw new Error(
      data.message || `Termii request failed with status ${response.status}`,
    );
  }

  return data;
}

export async function sendPhoneOtp(phone: string) {
  const to = normalizePhoneNumber(phone);

  const result = await termiiRequest<TermiiSendOtpResponse>(
    "/sms/otp/send",
    {
      message_type: "NUMERIC",
      to,
      from: env.TERMII_SENDER_ID,
      channel: env.TERMII_CHANNEL,
      pin_attempts: 3,
      pin_time_to_live: env.TERMII_OTP_TTL_MINUTES,
      pin_length: 6,
      pin_placeholder: "< 123456 >",
      message_text:
        "Your TransConet verification code is < 123456 >. It expires soon.",
      pin_type: "NUMERIC",
    },
  );

  if (!result.pinId) {
    throw new Error("Termii did not return an OTP pin ID");
  }

  return {
    pinId: result.pinId,
    phone: to,
  };
}

export async function verifyPhoneOtp(
  pinId: string,
  pin: string,
) {
  const result = await termiiRequest<TermiiVerifyOtpResponse>(
    "/sms/otp/verify",
    {
      pin_id: pinId,
      pin,
    },
  );

  const verified =
    result.verified === true ||
    result.status?.toLowerCase() === "success";

  if (!verified) {
    throw new Error(result.message || "Invalid verification code");
  }

  return {
    verified: true,
    phone: result.msisdn,
  };
}

export async function sendSms(
  phone: string,
  message: string,
) {
  const to = normalizePhoneNumber(phone);

  return termiiRequest<{
    messageId?: string;
    message?: string;
    status?: string;
  }>("/sms/send", {
    to,
    from: env.TERMII_SENDER_ID,
    channel: env.TERMII_CHANNEL,
    sms: message,
    type: "plain",
  });
}
