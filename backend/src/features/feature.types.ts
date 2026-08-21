export type FeatureAudience = "CUSTOMER" | "TRANSPORTER" | "INTERNAL";

export type FeatureEvaluationContext = {
  userId?: string;
  audience: FeatureAudience;
};

export type FeatureEvaluation = {
  key: string;
  enabled: boolean;
  reason:
    | "ENABLED"
    | "DISABLED"
    | "INTERNAL_ONLY"
    | "AUDIENCE_DISABLED"
    | "ROLLOUT_EXCLUDED"
    | "NOT_FOUND";
};
