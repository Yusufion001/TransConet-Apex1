import { useState } from "react";
import type { FormEvent } from "react";
import { useAuthStore } from "./auth.store";

export default function Login() {
  const login = useAuthStore((state) => state.login);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(identifier.trim(), password);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in",
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

        <div className="login-heading">
          <h1>Administrator Sign In</h1>
          <p>Access the TransConet administration platform.</p>
        </div>

        <form onSubmit={handleSubmit}>
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

          <button
            className="login-button"
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="login-security">
          Administrator access is protected by the TransConet backend
          authorization system.
        </p>
      </section>
    </main>
  );
}
