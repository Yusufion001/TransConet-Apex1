import { Resend } from "resend";
import { env } from "../config/env.js";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
) {
  const resetUrl =
    `${env.PASSWORD_RESET_URL}?token=${encodeURIComponent(resetToken)}`;

  const result = await resend.emails.send({
    from: env.EMAIL_FROM_ADDRESS,
    to: email,
    subject: "Reset your TransConet password",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Reset your TransConet password</h2>
        <p>We received a request to reset your TransConet password.</p>
        <p>
          <a href="${resetUrl}"
             style="display:inline-block;padding:12px 20px;background:#111827;color:#ffffff;text-decoration:none;border-radius:6px;">
            Reset Password
          </a>
        </p>
        <p>This link expires in 30 minutes.</p>
        <p>If you did not request this reset, you can safely ignore this email.</p>
      </div>
    `,
  });

  if (result.error) {
    throw new Error("Failed to send password reset email");
  }

  return result.data;
}
