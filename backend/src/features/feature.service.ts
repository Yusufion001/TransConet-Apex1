import { createHash } from "node:crypto";
import { prisma } from "../config/prisma.js";
import type {
  FeatureAudience,
  FeatureEvaluation,
  FeatureEvaluationContext,
} from "./feature.types.js";

type FeatureRow = {
  key: string;
  enabled: boolean;
  visibility: "INTERNAL" | "PUBLIC";
  rolloutPercentage: number;
  customerEnabled: boolean;
  transporterEnabled: boolean;
};

function rolloutBucket(key: string, userId: string): number {
  const digest = createHash("sha256")
    .update(`${key}:${userId}`)
    .digest();

  return digest.readUInt32BE(0) % 100;
}

function evaluateFeatureRow(
  feature: FeatureRow | null,
  context: FeatureEvaluationContext,
): FeatureEvaluation {
  if (!feature) {
    return {
      key: "",
      enabled: false,
      reason: "NOT_FOUND",
    };
  }

  if (!feature.enabled) {
    return {
      key: feature.key,
      enabled: false,
      reason: "DISABLED",
    };
  }

  if (
    context.audience !== "INTERNAL" &&
    feature.visibility !== "PUBLIC"
  ) {
    return {
      key: feature.key,
      enabled: false,
      reason: "INTERNAL_ONLY",
    };
  }

  if (
    context.audience === "CUSTOMER" &&
    !feature.customerEnabled
  ) {
    return {
      key: feature.key,
      enabled: false,
      reason: "AUDIENCE_DISABLED",
    };
  }

  if (
    context.audience === "TRANSPORTER" &&
    !feature.transporterEnabled
  ) {
    return {
      key: feature.key,
      enabled: false,
      reason: "AUDIENCE_DISABLED",
    };
  }

  if (feature.rolloutPercentage <= 0) {
    return {
      key: feature.key,
      enabled: false,
      reason: "ROLLOUT_EXCLUDED",
    };
  }

  if (feature.rolloutPercentage >= 100) {
    return {
      key: feature.key,
      enabled: true,
      reason: "ENABLED",
    };
  }

  if (!context.userId) {
    return {
      key: feature.key,
      enabled: false,
      reason: "ROLLOUT_EXCLUDED",
    };
  }

  const bucket = rolloutBucket(feature.key, context.userId);

  if (bucket >= feature.rolloutPercentage) {
    return {
      key: feature.key,
      enabled: false,
      reason: "ROLLOUT_EXCLUDED",
    };
  }

  return {
    key: feature.key,
    enabled: true,
    reason: "ENABLED",
  };
}

export async function evaluateFeature(
  key: string,
  context: FeatureEvaluationContext,
): Promise<FeatureEvaluation> {
  const feature = await prisma.featureFlag.findUnique({
    where: { key },
    select: {
      key: true,
      enabled: true,
      visibility: true,
      rolloutPercentage: true,
      customerEnabled: true,
      transporterEnabled: true,
    },
  });

  return evaluateFeatureRow(feature, context);
}

export async function isFeatureEnabled(
  key: string,
  context: FeatureEvaluationContext,
): Promise<boolean> {
  const result = await evaluateFeature(key, context);

  return result.enabled;
}

export async function getEnabledFeatures(
  context: FeatureEvaluationContext,
): Promise<string[]> {
  const features = await prisma.featureFlag.findMany({
    where: {
      enabled: true,
    },
    select: {
      key: true,
      enabled: true,
      visibility: true,
      rolloutPercentage: true,
      customerEnabled: true,
      transporterEnabled: true,
    },
    orderBy: {
      key: "asc",
    },
  });

  return features
    .map((feature) => evaluateFeatureRow(feature, context))
    .filter((result) => result.enabled)
    .map((result) => result.key);
}
