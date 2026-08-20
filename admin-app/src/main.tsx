import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ProtectedApp from "./auth/ProtectedApp";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ProtectedApp />
  </StrictMode>,
);
