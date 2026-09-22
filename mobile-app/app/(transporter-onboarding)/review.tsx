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
    backgroundColor: "#F4F7FF",
  },
  container: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 52,
  },
  header: {
    marginBottom: 22,
  },
  eyebrow: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#E8EEFF",
    color: "#4169E1",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.8,
    marginBottom: 14,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    color: "#101B3A",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: "#667085",
    maxWidth: 480,
  },
  progressRow: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 8,
  },
  progressStepActive: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#4169E1",
  },
  progressText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#667085",
    marginBottom: 20,
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#C9D7FF",
    borderRadius: 20,
    padding: 18,
    backgroundColor: "#EEF3FF",
    marginBottom: 16,
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4169E1",
    marginRight: 14,
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  statusIconText: {
    color: "#FFFFFF",
    fontSize: 23,
    lineHeight: 27,
    fontWeight: "900",
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    color: "#101B3A",
    marginBottom: 5,
  },
  statusDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: "#475467",
  },
  card: {
    borderWidth: 1,
    borderColor: "#E3E8F4",
    borderRadius: 20,
    padding: 18,
    backgroundColor: "#FFFFFF",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "900",
    color: "#101B3A",
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 55,
    borderTopWidth: 1,
    borderTopColor: "#EEF1F6",
  },
  checkCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF1F6",
    marginRight: 11,
  },
  checkCircleComplete: {
    backgroundColor: "#4169E1",
  },
  checkText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#98A2B3",
  },
  checkTextComplete: {
    color: "#FFFFFF",
  },
  statusRowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#344054",
  },
  statusRowValue: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    color: "#98A2B3",
  },
  statusRowValueComplete: {
    color: "#4169E1",
  },
  currentStepBox: {
    marginTop: 14,
    padding: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D8E1FA",
    backgroundColor: "#F5F7FF",
  },
  currentStepLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#667085",
    marginBottom: 6,
  },
  currentStepValue: {
    fontSize: 15,
    fontWeight: "900",
    color: "#1F3FAE",
  },
  tierCard: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#D8E1FA",
    borderRadius: 20,
    padding: 18,
    backgroundColor: "#FFFFFF",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  tierTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    color: "#101B3A",
    marginBottom: 7,
  },
  tierText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#667085",
  },
  tierStatus: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#E8EEFF",
    fontSize: 11,
    fontWeight: "900",
    color: "#4169E1",
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 15,
    backgroundColor: "#4169E1",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  refreshButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#4169E1",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F4F7FF",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#667085",
    fontWeight: "600",
  },
  errorTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900",
    color: "#101B3A",
    marginBottom: 7,
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
    marginBottom: 20,
    textAlign: "center",
  },
  retryButton: {
    minWidth: 130,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#4169E1",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 9,
    elevation: 3,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
});
