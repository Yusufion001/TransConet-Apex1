import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";

import { useAuthStore } from "../../src/auth/auth.store";
import {
  getTransporterOnboardingStatus,
  type TransporterOnboardingStatus,
} from "../../src/api/transporter";

function getCurrentStepTitle(
  step: TransporterOnboardingStatus["currentStep"],
) {
  switch (step) {
    case "EMAIL_VERIFICATION":
      return "Email verification";
    case "PROFILE_SETUP":
      return "Profile setup";
    case "DOCUMENTS":
      return "Documents";
    case "IDENTITY_VERIFICATION":
      return "Identity verification";
    case "VEHICLE":
      return "Vehicle";
    case "ADMIN_REVIEW":
      return "Admin review";
    case "APPROVED":
      return "Approved";
    case "TIER_2_DOCUMENTS":
      return "Tier 2 documents";
    case "TIER_2_REVIEW":
      return "Tier 2 review";
    default:
      return "Onboarding";
  }
}

function getStatusText(status: TransporterOnboardingStatus) {
  if (status.marketplaceReady) {
    return "Your transporter account is ready for the marketplace.";
  }

  if (status.adminApproved) {
    return "Your transporter account has been approved.";
  }

  if (!status.vehicleApproved) {
    return "Your vehicle is still awaiting verification.";
  }

  if (!status.identityDocumentApproved) {
    return "Your identity document is still awaiting approval.";
  }

  return "Your onboarding is being reviewed.";
}

export default function TransporterReviewScreen() {
  const user = useAuthStore((state) => state.user);

  const [status, setStatus] =
    useState<TransporterOnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStatus = useCallback(
    async (showRefreshing = false) => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        if (showRefreshing) {
          setRefreshing(true);
        }

        const result = await getTransporterOnboardingStatus(user.id);
        setStatus(result);
      } catch (error) {
        console.error(
          "Failed to load transporter onboarding status:",
          error,
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadStatus();
    }, 15000);

    return () => clearInterval(interval);
  }, [loadStatus]);

  const handleContinue = () => {
    if (!status) return;

    if (status.marketplaceReady || status.adminApproved) {
      router.replace("/(transporter)");
      return;
    }

    if (status.currentStep === "TIER_2_DOCUMENTS") {
      router.replace("/(transporter-onboarding)/tier2-documents");
      return;
    }

    if (status.currentStep === "TIER_2_REVIEW") {
      router.replace("/(transporter-onboarding)/tier2-review");
      return;
    }

    router.replace("/(transporter)");
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>
          Checking your onboarding status...
        </Text>
      </View>
    );
  }

  if (!status) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.errorTitle}>
          Unable to load onboarding status
        </Text>
        <Text style={styles.errorText}>
          Please try again.
        </Text>

        <Pressable
          style={styles.retryButton}
          onPress={() => void loadStatus(true)}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.retryButtonText}>Retry</Text>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>TRANSCONET</Text>
          <Text style={styles.title}>Application review</Text>
          <Text style={styles.subtitle}>
            Your onboarding information has been submitted. We will keep
            checking your verification status.
          </Text>
        </View>

        <View style={styles.progressRow}>
          <View style={styles.progressStepActive} />
          <View style={styles.progressStepActive} />
          <View style={styles.progressStepActive} />
          <View style={styles.progressStepActive} />
        </View>

        <Text style={styles.progressText}>STEP 4 OF 4</Text>

        <View style={styles.statusCard}>
          <View style={styles.statusIcon}>
            <Text style={styles.statusIconText}>
              {status.marketplaceReady || status.adminApproved ? "✓" : "•"}
            </Text>
          </View>

          <View style={styles.statusContent}>
            <Text style={styles.statusTitle}>
              {status.marketplaceReady
                ? "Onboarding complete"
                : status.adminApproved
                  ? "Application approved"
                  : "Verification in progress"}
            </Text>

            <Text style={styles.statusDescription}>
              {status.marketplaceReady
                ? "Your transporter account is ready for the marketplace."
                : status.adminApproved
                  ? "Your transporter account has been approved. Complete any remaining marketplace requirements."
                  : getStatusText(status)}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Application status</Text>

          <StatusRow
            label="Email verification"
            complete={status.emailVerified}
          />

          <StatusRow
            label="Profile"
            complete={status.profileCompleted}
          />

          <StatusRow
            label="Identity document"
            complete={status.identityDocumentApproved}
          />

          <StatusRow
            label="Vehicle"
            complete={status.vehicleApproved}
          />

          <StatusRow
            label="Admin approval"
            complete={status.adminApproved}
          />

          <View style={styles.currentStepBox}>
            <Text style={styles.currentStepLabel}>CURRENT STAGE</Text>
            <Text style={styles.currentStepValue}>
              {getCurrentStepTitle(status.currentStep)}
            </Text>
          </View>
        </View>

        {status.tier2Eligible ? (
          <View style={styles.tierCard}>
            <Text style={styles.tierTitle}>Tier 2</Text>
            <Text style={styles.tierText}>
              Your account is eligible for Tier 2. Tier 2 approval requires
              the required insurance and business certificates to be
              submitted and approved.
            </Text>

            <Text style={styles.tierStatus}>
              {status.tier2Approved
                ? "Tier 2 approved"
                : "Tier 2 not yet approved"}
            </Text>
          </View>
        ) : null}

        <Pressable
          style={[
            styles.primaryButton,
            !status.adminApproved && styles.buttonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!status.adminApproved}
        >
          <Text style={styles.primaryButtonText}>
            {status.adminApproved
              ? "Enter transporter dashboard"
              : "Awaiting approval"}
          </Text>
        </Pressable>

        <Pressable
          style={styles.refreshButton}
          onPress={() => void loadStatus(true)}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.refreshButtonText}>
              Refresh status
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

function StatusRow({
  label,
  complete,
}: {
  label: string;
  complete: boolean;
}) {
  return (
    <View style={styles.statusRow}>
      <View
        style={[
          styles.checkCircle,
          complete && styles.checkCircleComplete,
        ]}
      >
        <Text
          style={[
            styles.checkText,
            complete && styles.checkTextComplete,
          ]}
        >
          {complete ? "✓" : "•"}
        </Text>
      </View>

      <Text style={styles.statusRowLabel}>{label}</Text>

      <Text
        style={[
          styles.statusRowValue,
          complete && styles.statusRowValueComplete,
        ]}
      >
        {complete ? "COMPLETE" : "PENDING"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 24,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#111111",
    marginBottom: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#111111",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#666666",
  },
  progressRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  progressStepActive: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#111111",
  },
  progressText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#777777",
    marginBottom: 24,
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 18,
    backgroundColor: "#F5F5F5",
    marginBottom: 16,
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111111",
    marginRight: 14,
  },
  statusIconText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111111",
    marginBottom: 5,
  },
  statusDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: "#666666",
  },
  card: {
    borderWidth: 1,
    borderColor: "#E7E7E7",
    borderRadius: 16,
    padding: 18,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#111111",
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEEEEE",
    marginRight: 10,
  },
  checkCircleComplete: {
    backgroundColor: "#111111",
  },
  checkText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#777777",
  },
  checkTextComplete: {
    color: "#FFFFFF",
  },
  statusRowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#333333",
  },
  statusRowValue: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: "#888888",
  },
  statusRowValueComplete: {
    color: "#111111",
  },
  currentStepBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#F5F5F5",
  },
  currentStepLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#777777",
    marginBottom: 5,
  },
  currentStepValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111111",
  },
  tierCard: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#E7E7E7",
    borderRadius: 16,
    padding: 18,
  },
  tierTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111111",
    marginBottom: 6,
  },
  tierText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#666666",
  },
  tierStatus: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "800",
    color: "#111111",
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  refreshButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#555555",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#FFFFFF",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666666",
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111111",
    marginBottom: 6,
  },
  errorText: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 20,
  },
  retryButton: {
    minWidth: 120,
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
