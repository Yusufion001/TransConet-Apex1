import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ProtectedApp from "./auth/ProtectedApp";
import ErrorBoundary from "./ErrorBoundary";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ProtectedApp />
    </ErrorBoundary>
  </StrictMode>,
);
