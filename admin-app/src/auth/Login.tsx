import { useState } from "react";
import type { FormEvent } from "react";
import { apiClient } from "../api/client";
import { useAuthStore } from "./auth.store";
import type { AdminSession, AdminMfaChallenge } from "./auth.types";

type AuthMode = "login" | "mfa" | "forgot" | "reset";

export default function Login() {
  const login = useAuthStore((state) => state.login);
  const establishSession = useAuthStore((state) => state.establishSession);

  const [mode, setMode] = useState<AuthMode>("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaChallenge, setMfaChallenge] = useState<AdminMfaChallenge | null>(
    null,
  );
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setMessage("");

    if (nextMode !== "mfa") {
      setMfaCode("");
      setMfaChallenge(null);
    }
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const result = await login(identifier.trim(), password);

      if (result.requiresMfa) {
        setMfaChallenge(result);
        setMfaCode("");
        setMode("mfa");
        setMessage(
          "Enter the 6-digit code from your authenticator app to continue.",
        );
        return;
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to sign in",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaVerification(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    const code = mfaCode.trim();

    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit authenticator code.");
      return;
    }

    if (!mfaChallenge) {
      setError("Your MFA challenge is no longer available. Please sign in again.");
      setMode("login");
      return;
    }

    if (new Date(mfaChallenge.expiresAt).getTime() <= Date.now()) {
      setError("Your MFA challenge has expired. Please sign in again.");
      setMode("login");
      setMfaCode("");
      setMfaChallenge(null);
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.post<{
        success: boolean;
        data: AdminSession;
      }>("/auth/verify-mfa", {
        challenge: mfaChallenge.challengeId,
        code,
      });

      const session = response.data.data;

      if (!session || session.requiresMfa) {
        throw new Error("Invalid MFA verification response.");
      }

      if (session.user.role !== "ADMIN") {
        throw new Error("Administrator access required");
      }

      if (session.user.status && session.user.status !== "ACTIVE") {
        throw new Error("Administrator account is not active");
      }

      establishSession(session);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Invalid or expired MFA challenge",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    const value = identifier.trim();

    if (!value) {
      setError("Enter your administrator email or phone number.");
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.post<{
        success: boolean;
        data?: {
          message?: string;
        };
        error?: string;
      }>("/auth/forgot-password", {
        identifier: value,
      });

      setMessage(
        response.data.data?.message ||
          "If an administrator account exists, a password reset email has been sent.",
      );
      setMode("reset");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to request a password reset.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!resetToken.trim()) {
      setError("Enter the password reset token from your email.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.post<{
        success: boolean;
        data?: {
          message?: string;
        };
        error?: string;
      }>("/auth/reset-password", {
        token: resetToken.trim(),
        password: newPassword,
      });

      setMessage(
        response.data.data?.message ||
          "Your password has been reset successfully. You can now sign in.",
      );
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setResetToken("");
      setMode("login");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to reset your password.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="login-mark">T</div>
          <div>
            <strong>TransConet</strong>
            <span>Administration Management</span>
          </div>
        </div>

        {mode === "login" && (
          <>
            <div className="login-heading">
              <h1>Administrator Sign In</h1>
              <p>
                Access the TransConet administration platform.
              </p>
            </div>

            <form onSubmit={handleLogin}>
              <label>
                Email or phone
                <input
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  autoComplete="username"
                  placeholder="Enter administrator email or phone"
                  required
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter password"
                  required
                />
              </label>

              {error && <div className="login-error">{error}</div>}

              {message && (
                <div className="login-message">{message}</div>
              )}

              <button
                className="login-button"
                type="submit"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <button
              type="button"
              className="login-link"
              onClick={() => switchMode("forgot")}
            >
              Forgot Password?
            </button>
          </>
        )}

        {mode === "mfa" && (
          <>
            <div className="login-heading">
              <h1>Two-Factor Authentication</h1>
              <p>
                Enter the 6-digit verification code from your authenticator
                app to complete administrator sign in.
              </p>
            </div>

            <form onSubmit={handleMfaVerification}>
              <label>
                Authentication code
                <input
                  value={mfaCode}
                  onChange={(event) =>
                    setMfaCode(
                      event.target.value.replace(/\D/g, "").slice(0, 6),
                    )
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="Enter 6-digit code"
                  required
                  autoFocus
                />
              </label>

              {mfaChallenge && (
                <div className="login-security">
                  This verification request expires at{" "}
                  {new Date(mfaChallenge.expiresAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  .
                </div>
              )}

              {error && <div className="login-error">{error}</div>}

              {message && (
                <div className="login-message">{message}</div>
              )}

              <button
                className="login-button"
                type="submit"
                disabled={loading}
              >
                {loading ? "Verifying..." : "Verify and Sign In"}
              </button>
            </form>

            <button
              type="button"
              className="login-link"
              onClick={() => switchMode("login")}
            >
              Back to Administrator Sign In
            </button>
          </>
        )}

        {mode === "forgot" && (
          <>
            <div className="login-heading">
              <h1>Forgot Password?</h1>
              <p>
                Enter your administrator email or phone number to request a
                password reset.
              </p>
            </div>

            <form onSubmit={handleForgotPassword}>
              <label>
                Administrator email or phone
                <input
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  autoComplete="username"
                  placeholder="Enter administrator email or phone"
                  required
                />
              </label>

              {error && <div className="login-error">{error}</div>}

              {message && (
                <div className="login-message">{message}</div>
              )}

              <button
                className="login-button"
                type="submit"
                disabled={loading}
              >
                {loading ? "Sending..." : "Send Reset Instructions"}
              </button>
            </form>

            <button
              type="button"
              className="login-link"
              onClick={() => switchMode("login")}
            >
              Back to Administrator Sign In
            </button>
          </>
        )}

        {mode === "reset" && (
          <>
            <div className="login-heading">
              <h1>Reset Administrator Password</h1>
              <p>
                Enter the reset token from your email and choose a new
                password.
              </p>
            </div>

            <form onSubmit={handleResetPassword}>
              <label>
                Reset token
                <input
                  value={resetToken}
                  onChange={(event) => setResetToken(event.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Enter 6-digit reset token"
                  required
                />
              </label>

              <label>
                New password
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Enter new password"
                  required
                />
              </label>

              <label>
                Confirm new password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  autoComplete="new-password"
                  placeholder="Confirm new password"
                  required
                />
              </label>

              {error && <div className="login-error">{error}</div>}

              {message && (
                <div className="login-message">{message}</div>
              )}

              <button
                className="login-button"
                type="submit"
                disabled={loading}
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>

            <button
              type="button"
              className="login-link"
              onClick={() => switchMode("login")}
            >
              Back to Administrator Sign In
            </button>
          </>
        )}

        <p className="login-security">
          Administrator access is protected by the TransConet backend
          authorization system.
        </p>
      </section>
    </main>
  );
}
