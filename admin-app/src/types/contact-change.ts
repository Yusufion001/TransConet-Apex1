export type AdminContactChange = {
  id: string;
  type: "EMAIL" | "PHONE";
  status:
    | "PENDING_LIVENESS"
    | "LIVENESS_VERIFIED"
    | "PENDING_CONTACT_VERIFICATION"
    | "COMPLETED"
    | "FAILED"
    | "CANCELLED"
    | "EXPIRED";
  currentValue: string;
  requestedValue: string;
  livenessVerifiedAt: string | null;
  contactVerifiedAt: string | null;
  completedAt: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  contactVerificationAttempts: number;
};
