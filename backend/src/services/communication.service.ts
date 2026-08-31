import {
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
  sendAdminInvitationEmail,
} from "./email.service.js";
import { sendSms } from "./termii.service.js";

type CommunicationRecipient = {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

async function sendEmailIfAvailable(
  email: string | null | undefined,
  subject: string,
  message: string,
) {
  if (!email) return;

  const { sendBusinessEmail } = await import("./email.service.js");
  await sendBusinessEmail(email, subject, message);
}

async function sendSmsIfAvailable(
  phone: string | null | undefined,
  message: string,
) {
  if (!phone) return;
  await sendSms(phone, message);
}

async function sendBoth(
  recipient: CommunicationRecipient,
  emailSubject: string,
  emailMessage: string,
  smsMessage: string,
) {
  const results = await Promise.allSettled([
    recipient.email
      ? sendEmailIfAvailable(
          recipient.email,
          emailSubject,
          emailMessage,
        )
      : Promise.resolve(),

    recipient.phone
      ? sendSmsIfAvailable(recipient.phone, smsMessage)
      : Promise.resolve(),
  ]);

  const failures = results.filter(
    (result): result is PromiseRejectedResult =>
      result.status === "rejected",
  );

  if (failures.length > 0) {
    throw failures[0].reason instanceof Error
      ? failures[0].reason
      : new Error("Communication delivery failed");
  }
}

/* -------------------------------------------------------------------------- */
/* Registration                                                              */
/* -------------------------------------------------------------------------- */

export async function sendRegistrationSuccessEmail(
  recipient: CommunicationRecipient,
) {
  if (!recipient.email) return;
  await sendEmailIfAvailable(
    recipient.email,
    "Welcome to TransConet",
    `Welcome to TransConet, ${recipient.firstName ?? "there"}. Your registration was successful.`,
  );
}

export async function sendRegistrationFailureEmail(
  recipient: CommunicationRecipient,
) {
  if (!recipient.email) return;
  await sendEmailIfAvailable(
    recipient.email,
    "TransConet registration unsuccessful",
    `Hello ${recipient.firstName ?? "there"}, we could not complete your TransConet registration.`,
  );
}

export async function sendRegistrationSuccessSms(
  recipient: CommunicationRecipient,
) {
  await sendSmsIfAvailable(
    recipient.phone,
    "Your TransConet registration was successful.",
  );
}

export async function sendRegistrationFailureSms(
  recipient: CommunicationRecipient,
) {
  await sendSmsIfAvailable(
    recipient.phone,
    "We could not complete your TransConet registration. Please try again.",
  );
}

/* -------------------------------------------------------------------------- */
/* Verification                                                              */
/* -------------------------------------------------------------------------- */

export async function sendVerificationSuccessEmail(
  recipient: CommunicationRecipient,
) {
  if (!recipient.email) return;
  await sendEmailIfAvailable(
    recipient.email,
    "TransConet verification successful",
    `Hello ${recipient.firstName ?? "there"}, your TransConet verification was successful.`,
  );
}

export async function sendVerificationFailureEmail(
  recipient: CommunicationRecipient,
) {
  if (!recipient.email) return;
  await sendEmailIfAvailable(
    recipient.email,
    "TransConet verification unsuccessful",
    `Hello ${recipient.firstName ?? "there"}, your TransConet verification could not be completed.`,
  );
}

export async function sendVerificationSuccessSms(
  recipient: CommunicationRecipient,
) {
  await sendSmsIfAvailable(
    recipient.phone,
    "Your TransConet verification was successful.",
  );
}

export async function sendVerificationFailureSms(
  recipient: CommunicationRecipient,
) {
  await sendSmsIfAvailable(
    recipient.phone,
    "Your TransConet verification could not be completed. Please try again.",
  );
}

/* -------------------------------------------------------------------------- */
/* Marketplace                                                               */
/* -------------------------------------------------------------------------- */

export async function sendBidSubmittedEmail(
  recipient: CommunicationRecipient,
) {
  if (!recipient.email) return;
  await sendEmailIfAvailable(
    recipient.email,
    "TransConet bid submitted",
    `Hello ${recipient.firstName ?? "there"}, your marketplace bid has been submitted successfully.`,
  );
}

export async function sendBidRejectedEmail(
  recipient: CommunicationRecipient,
) {
  if (!recipient.email) return;
  await sendEmailIfAvailable(
    recipient.email,
    "TransConet bid rejected",
    `Hello ${recipient.firstName ?? "there"}, your marketplace bid was rejected.`,
  );
}

export async function sendBidSubmittedSms(
  recipient: CommunicationRecipient,
) {
  await sendSmsIfAvailable(
    recipient.phone,
    "Your TransConet marketplace bid was submitted successfully.",
  );
}

export async function sendBidRejectedSms(
  recipient: CommunicationRecipient,
) {
  await sendSmsIfAvailable(
    recipient.phone,
    "Your TransConet marketplace bid was rejected.",
  );
}

/* -------------------------------------------------------------------------- */
/* Payments                                                                  */
/* -------------------------------------------------------------------------- */

export async function sendPaymentInitializedEmail(
  recipient: CommunicationRecipient,
) {
  if (!recipient.email) return;
  await sendEmailIfAvailable(
    recipient.email,
    "TransConet payment initialized",
    "Your TransConet payment has been initialized successfully.",
  );
}

export async function sendPaymentSuccessEmail(
  recipient: CommunicationRecipient,
) {
  if (!recipient.email) return;
  await sendEmailIfAvailable(
    recipient.email,
    "TransConet payment successful",
    "Your TransConet payment was successful.",
  );
}

export async function sendPaymentFailureEmail(
  recipient: CommunicationRecipient,
) {
  if (!recipient.email) return;
  await sendEmailIfAvailable(
    recipient.email,
    "TransConet payment failed",
    "Your TransConet payment could not be completed.",
  );
}

export async function sendPaymentInitializedSms(
  recipient: CommunicationRecipient,
) {
  await sendSmsIfAvailable(
    recipient.phone,
    "Your TransConet payment has been initialized.",
  );
}

export async function sendPaymentSuccessSms(
  recipient: CommunicationRecipient,
) {
  await sendSmsIfAvailable(
    recipient.phone,
    "Your TransConet payment was successful.",
  );
}

export async function sendPaymentFailureSms(
  recipient: CommunicationRecipient,
) {
  await sendSmsIfAvailable(
    recipient.phone,
    "Your TransConet payment could not be completed.",
  );
}

/* -------------------------------------------------------------------------- */
/* Combined delivery helpers                                                  */
/* -------------------------------------------------------------------------- */

export async function sendRegistrationSuccess(
  recipient: CommunicationRecipient,
) {
  await sendBoth(
    recipient,
    "Welcome to TransConet",
    `Welcome to TransConet, ${recipient.firstName ?? "there"}. Your registration was successful.`,
    "Your TransConet registration was successful.",
  );
}

export async function sendRegistrationFailure(
  recipient: CommunicationRecipient,
) {
  await sendBoth(
    recipient,
    "TransConet registration unsuccessful",
    `Hello ${recipient.firstName ?? "there"}, we could not complete your TransConet registration.`,
    "We could not complete your TransConet registration. Please try again.",
  );
}

export async function sendVerificationSuccess(
  recipient: CommunicationRecipient,
) {
  await sendBoth(
    recipient,
    "TransConet verification successful",
    `Hello ${recipient.firstName ?? "there"}, your TransConet verification was successful.`,
    "Your TransConet verification was successful.",
  );
}

export async function sendVerificationFailure(
  recipient: CommunicationRecipient,
) {
  await sendBoth(
    recipient,
    "TransConet verification unsuccessful",
    `Hello ${recipient.firstName ?? "there"}, your TransConet verification could not be completed.`,
    "Your TransConet verification could not be completed. Please try again.",
  );
}

export async function sendBidSubmitted(
  recipient: CommunicationRecipient,
) {
  await sendBoth(
    recipient,
    "TransConet bid submitted",
    `Hello ${recipient.firstName ?? "there"}, your marketplace bid has been submitted successfully.`,
    "Your TransConet marketplace bid was submitted successfully.",
  );
}

export async function sendBidRejected(
  recipient: CommunicationRecipient,
) {
  await sendBoth(
    recipient,
    "TransConet bid rejected",
    `Hello ${recipient.firstName ?? "there"}, your marketplace bid was rejected.`,
    "Your TransConet marketplace bid was rejected.",
  );
}

export async function sendPaymentInitialized(
  recipient: CommunicationRecipient,
) {
  await sendBoth(
    recipient,
    "TransConet payment initialized",
    "Your TransConet payment has been initialized successfully.",
    "Your TransConet payment has been initialized.",
  );
}

export async function sendPaymentSuccess(
  recipient: CommunicationRecipient,
) {
  await sendBoth(
    recipient,
    "TransConet payment successful",
    "Your TransConet payment was successful.",
    "Your TransConet payment was successful.",
  );
}

export async function sendPaymentFailure(
  recipient: CommunicationRecipient,
) {
  await sendBoth(
    recipient,
    "TransConet payment failed",
    "Your TransConet payment could not be completed.",
    "Your TransConet payment could not be completed.",
  );
}

/* -------------------------------------------------------------------------- */
/* Existing communications — intentionally preserved                          */
/* -------------------------------------------------------------------------- */

export {
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
  sendAdminInvitationEmail,
};
