import { useState } from "react";
import type { FormEvent } from "react";
import { apiClient } from "../api/client";

export default function AdminInvitationSetup() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("This administrator invitation link is invalid.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.post<{
        success: boolean;
        data?: { message?: string };
        error?: string;
      }>("/auth/accept-admin-invitation", {
        token,
        password,
      });

      setMessage(
        response.data.data?.message ||
          "Your Administrator account has been set up successfully.",
      );
      setPassword("");
      setConfirmPassword("");
      setCompleted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to complete administrator account setup.",
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

        {!completed ? (
          <>
            <div className="login-heading">
              <h1>Set Up Your Administrator Account</h1>
              <p>
                Create your own password to activate your TransConet
                Administrator account.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <label>
                Create password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Create your password"
                  required
                />
              </label>

              <label>
                Confirm password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  autoComplete="new-password"
                  placeholder="Confirm your password"
                  required
                />
              </label>

              {error && <div className="login-error">{error}</div>}

              <button
                className="login-button"
                type="submit"
                disabled={loading}
              >
                {loading ? "Setting up account..." : "Create Password"}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="login-heading">
              <h1>Account Setup Complete</h1>
              <p>
                {message} You can now sign in using your Administrator
                email and the password you just created.
              </p>
            </div>

            <button
              className="login-button"
              type="button"
              onClick={() => {
                window.location.href = "/login";
              }}
            >
              Go to Administrator Sign In
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
