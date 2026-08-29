import { Resend } from "resend";
import { env } from "../config/env.js";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
) {
  const result = await resend.emails.send({
    from: env.EMAIL_FROM_ADDRESS,
    to: email,
    subject: "Your TransConet password reset token",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;max-width:600px;margin:auto">
        <h2>Reset your TransConet password</h2>
        <p>We received a request to reset your TransConet password.</p>
        <p>Your password reset token is:</p>
        <div style="font-size:32px;font-weight:800;letter-spacing:8px;padding:16px 20px;background:#f3f4f6;border-radius:8px;text-align:center">
          ${resetToken}
        </div>
        <p><strong>This token expires in 1 minute.</strong></p>
        <p>Enter this token together with your new password and password confirmation in the TransConet app.</p>
        <p>If you did not request this reset, you can safely ignore this email.</p>
      </div>
    `,
  });

  if (result.error) {
    throw new Error("Failed to send password reset email");
  }

  return result.data;
}

export async function sendEmailVerificationEmail(
  email: string,
  verificationToken: string,
) {
  const verificationUrl =
    `${env.EMAIL_VERIFICATION_URL}?token=${encodeURIComponent(verificationToken)}`;

  const result = await resend.emails.send({
    from: env.EMAIL_FROM_ADDRESS,
    to: email,
    subject: "Verify your TransConet email",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>Verify your TransConet email</h2>
        <p>Welcome to TransConet.</p>
        <p>Please verify your email address to activate your account.</p>
        <p>
          <a href="${verificationUrl}"
             style="display:inline-block;padding:12px 20px;background:#111827;color:#fff;text-decoration:none;border-radius:6px">
            Verify Email
          </a>
        </p>
        <p>This verification link expires in 24 hours.</p>
        <p>If you did not create this account, you can safely ignore this email.</p>
      </div>
    `,
  });

  if (result.error) {
    throw new Error("Failed to send verification email");
  }

  return result.data;
}


export async function sendAdminInvitationEmail(
  email: string,
  firstName: string,
  invitationToken: string,
  invitationExpiresAt: Date,
) {
  const invitationUrl =
    `${env.ADMIN_INVITATION_URL}?token=${encodeURIComponent(invitationToken)}`;

  const expiresInHours = Math.max(
    1,
    Math.ceil(
      (invitationExpiresAt.getTime() - Date.now()) /
        (1000 * 60 * 60),
    ),
  );

  const result = await resend.emails.send({
    from: env.EMAIL_FROM_ADDRESS,
    to: email,
    subject: "Your TransConet Administrator Invitation",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;max-width:600px;margin:auto">
        <h2>Welcome to TransConet Administration</h2>

        <p>Hello ${firstName || "Administrator"},</p>

        <p>
          You have been invited to become an administrator
          on the TransConet Management Platform.
        </p>

        <p>
          Click the button below to set your administrator password
          and activate your administrator access.
        </p>

        <p>
          <a href="${invitationUrl}"
             style="display:inline-block;padding:12px 20px;background:#111827;color:#fff;text-decoration:none;border-radius:6px">
            Set Administrator Password
          </a>
        </p>

        <p>
          Your invitation token is:
        </p>

        <div style="font-size:24px;font-weight:800;letter-spacing:3px;padding:16px 20px;background:#f3f4f6;border-radius:8px;text-align:center;word-break:break-all">
          ${invitationToken}
        </div>

        <p>
          This invitation expires in approximately
          <strong>${expiresInHours} hours</strong>.
        </p>

        <p>
          If you were not expecting this invitation, please contact
          the TransConet Super Administrator.
        </p>
      </div>
    `,
  });

  if (result.error) {
    throw new Error("Failed to send administrator invitation email");
  }

  return result.data;
}
