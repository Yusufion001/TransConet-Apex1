import { useEffect } from "react";
import App from "../App";
import Login from "./Login";
import AdminInvitationSetup from "./AdminInvitationSetup";
import { useAuthStore } from "./auth.store";

export default function ProtectedApp() {
  const isAuthenticated = useAuthStore(
    (state) => state.isAuthenticated,
  );

  const isLoading = useAuthStore(
    (state) => state.isLoading,
  );

  const restore = useAuthStore(
    (state) => state.restore,
  );

  const clearLocalSession = useAuthStore(
    (state) => state.clearLocalSession,
  );

  useEffect(() => {
    restore();
  }, [restore]);

  useEffect(() => {
    const handleAuthExpired = () => {
      clearLocalSession();
    };

    window.addEventListener(
      "transconet:auth-expired",
      handleAuthExpired,
    );

    return () => {
      window.removeEventListener(
        "transconet:auth-expired",
        handleAuthExpired,
      );
    };
  }, [clearLocalSession]);

  const invitationToken =
    new URLSearchParams(window.location.search).get("token")?.trim() ?? "";

  if (invitationToken) {
    return <AdminInvitationSetup />;
  }

  if (window.location.pathname === "/login") {
    return <Login />;
  }

  if (isLoading) {
    return (
      <main className="auth-loading">
        <div>
          <div className="loading-mark">T</div>
          <strong>TransConet-Apex1</strong>
          <span>
            Loading administration platform...
          </span>
        </div>
      </main>
    );
  }

  return isAuthenticated ? <App /> : <Login />;
}
