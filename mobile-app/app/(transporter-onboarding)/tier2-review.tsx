import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";

import { useAuthStore } from "../../src/auth/auth.store";
import {
  getTransporterDocuments,
  getTransporterOnboardingStatus,
  type TransporterDocument,
  type TransporterOnboardingStatus,
} from "../../src/api/transporter";

const TIER_2_TYPES = ["INSURANCE", "BUSINESS_DOCUMENT"] as const;

function getDocumentState(document?: TransporterDocument) {
  if (!document) {
    return "NOT_SUBMITTED";
  }

  if (document.status === "REJECTED") {
    return "REJECTED";
  }

  if (document.status === "APPROVED" && document.adminApproved) {
    return "APPROVED";
  }

  return "PENDING";
}

function getOverallMessage(status: TransporterOnboardingStatus) {
  if (status.tier2Approved) {
    return "Your Tier 2 application has been approved by an administrator.";
  }

  if (status.currentStep === "TIER_2_REVIEW") {
    return "Your Tier 2 documents have been submitted and are awaiting administrator review.";
  }

  if (status.tier2Eligible) {
    return "Complete your Tier 2 documents to request approval.";
  }

  return "Your Tier 2 eligibility is currently being checked.";
}

export default function Tier2ReviewScreen() {
  const user = useAuthStore((state) => state.user);

  const [status, setStatus] =
    useState<TransporterOnboardingStatus | null>(null);
  const [documents, setDocuments] = useState<TransporterDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(
    async (showRefreshing = false) => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        if (showRefreshing) {
          setRefreshing(true);
        }

        const [onboarding, transporterDocuments] = await Promise.all([
          getTransporterOnboardingStatus(user.id),
          getTransporterDocuments(user.id),
        ]);

        setStatus(onboarding);
        setDocuments(transporterDocuments);
      } catch (error) {
        console.error("Failed to load Tier 2 review:", error);

        if (!showRefreshing) {
          Alert.alert(
            "Unable to load status",
            "We could not load your Tier 2 review status. Please try again.",
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadData();
    }, 15000);

    return () => clearInterval(interval);
  }, [loadData]);

  const documentsByType = useMemo(() => {
    const map = new Map<string, TransporterDocument>();

    for (const document of documents) {
      map.set(document.type, document);
    }

    return map;
  }, [documents]);

  const approvedDocuments = TIER_2_TYPES.filter(
    (type) => getDocumentState(documentsByType.get(type)) === "APPROVED",
  ).length;

  const rejectedDocument = TIER_2_TYPES.find(
    (type) => getDocumentState(documentsByType.get(type)) === "REJECTED",
  );

  const handleContinue = () => {
    if (!status) {
      return;
    }

    if (status.tier2Approved) {
      if (status.marketplaceReady) {
        router.replace("/(transporter)");
      } else {
        Alert.alert(
          "Tier 2 approved",
          "Your Tier 2 approval is complete. Your transporter account still has other marketplace readiness requirements.",
        );
      }
      return;
    }

    if (rejectedDocument) {
      router.replace("/(transporter-onboarding)/tier2-documents");
      return;
    }

    if (status.currentStep === "TIER_2_DOCUMENTS") {
      router.replace("/(transporter-onboarding)/tier2-documents");
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>
          Checking Tier 2 verification...
        </Text>
      </View>
    );
  }

  if (!status) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.errorTitle}>Unable to load Tier 2 status</Text>
        <Text style={styles.errorText}>
          Please refresh and try again.
        </Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() => void loadData(true)}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Retry</Text>
          )}
        </Pressable>
      </View>
    );
  }

  const approved = status.tier2Approved;
  const underReview =
    !approved &&
    status.currentStep === "TIER_2_REVIEW" &&
    !rejectedDocument;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>TRANSCONET</Text>
          <Text style={styles.title}>Tier 2 review</Text>
          <Text style={styles.subtitle}>
            Tier 2 approval is required before your account can be recognized
            as eligible to handle highly valuable goods.
          </Text>
        </View>

        <View style={styles.statusCard}>
          <View
            style={[
              styles.statusIcon,
              approved && styles.statusIconApproved,
              underReview && styles.statusIconPending,
              rejectedDocument && styles.statusIconRejected,
            ]}
          >
            <Text style={styles.statusIconText}>
              {approved ? "✓" : rejectedDocument ? "!" : "•"}
            </Text>
          </View>

          <View style={styles.statusContent}>
            <Text style={styles.statusTitle}>
              {approved
                ? "Tier 2 approved"
                : rejectedDocument
                  ? "Action required"
                  : "Tier 2 under review"}
            </Text>

            <Text style={styles.statusDescription}>
              {getOverallMessage(status)}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tier 2 documents</Text>
          <Text style={styles.cardDescription}>
            {approvedDocuments} of {TIER_2_TYPES.length} documents approved
          </Text>

          <DocumentStatusRow
            title="Insurance Certificate"
            document={documentsByType.get("INSURANCE")}
          />

          <DocumentStatusRow
            title="Business Certificate"
            document={documentsByType.get("BUSINESS_DOCUMENT")}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Approval status</Text>

          <StatusRow
            label="Insurance approved"
            complete={status.tier2.insuranceApproved}
          />

          <StatusRow
            label="Business certificate approved"
            complete={status.tier2.businessCertificateApproved}
          />

          <StatusRow
            label="Document requirements met"
            complete={status.tier2.requirementsMet}
          />

          <StatusRow
            label="Administrator Tier 2 approval"
            complete={status.tier2Approved}
          />
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>What happens next?</Text>

          <Text style={styles.infoText}>
            {approved
              ? "Your Tier 2 approval has been recorded. Marketplace access remains controlled by the platform's normal readiness rules."
              : rejectedDocument
                ? "Review the rejection reason, replace the rejected document, and submit it again for administrator review."
                : "An administrator will review both documents. You do not need to submit another request while they are under review."}
          </Text>
        </View>

        <Pressable
          style={styles.primaryButton}
          onPress={handleContinue}
        >
          <Text style={styles.primaryButtonText}>
            {approved
              ? status.marketplaceReady
                ? "Enter transporter dashboard"
                : "View transporter status"
              : rejectedDocument || status.currentStep === "TIER_2_DOCUMENTS"
                ? "Review Tier 2 documents"
                : "Awaiting administrator approval"}
          </Text>
        </Pressable>

        <Pressable
          style={styles.refreshButton}
          onPress={() => void loadData(true)}
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

function DocumentStatusRow({
  title,
  document,
}: {
  title: string;
  document?: TransporterDocument;
}) {
  const state = getDocumentState(document);

  return (
    <View style={styles.documentRow}>
      <View style={styles.documentInfo}>
        <Text style={styles.documentTitle}>{title}</Text>

        <Text style={styles.documentState}>
          {state === "APPROVED"
            ? "Approved"
            : state === "REJECTED"
              ? "Rejected"
              : state === "PENDING"
                ? "Pending administrator review"
                : "Not submitted"}
        </Text>

        {state === "REJECTED" && document?.rejectionReason ? (
          <Text style={styles.rejectionText}>
            Reason: {document.rejectionReason}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.stateDot,
          state === "APPROVED" && styles.stateDotApproved,
          state === "REJECTED" && styles.stateDotRejected,
          state === "PENDING" && styles.stateDotPending,
        ]}
      />
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
  statusCard: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#E1E1E1",
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  statusIconApproved: {
    backgroundColor: "#E6F4EA",
  },
  statusIconPending: {
    backgroundColor: "#FFF4D6",
  },
  statusIconRejected: {
    backgroundColor: "#FDE8E8",
  },
  statusIconText: {
    fontSize: 21,
    fontWeight: "800",
    color: "#111111",
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111111",
    marginBottom: 5,
  },
  statusDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: "#555555",
  },
  card: {
    borderWidth: 1,
    borderColor: "#E1E1E1",
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#111111",
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: "#666666",
    marginTop: 4,
    marginBottom: 6,
  },
  documentRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    paddingVertical: 15,
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111111",
    marginBottom: 4,
  },
  documentState: {
    fontSize: 13,
    color: "#666666",
  },
  rejectionText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#B42318",
    marginTop: 6,
  },
  stateDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#D5D5D5",
    marginLeft: 12,
  },
  stateDotApproved: {
    backgroundColor: "#178A45",
  },
  stateDotRejected: {
    backgroundColor: "#C62828",
  },
  stateDotPending: {
    backgroundColor: "#D89B00",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#EEEEEE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  checkCircleComplete: {
    backgroundColor: "#111111",
  },
  checkText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#666666",
  },
  checkTextComplete: {
    color: "#FFFFFF",
  },
  statusRowLabel: {
    flex: 1,
    fontSize: 14,
    color: "#333333",
  },
  statusRowValue: {
    fontSize: 10,
    fontWeight: "800",
    color: "#888888",
  },
  statusRowValueComplete: {
    color: "#111111",
  },
  infoCard: {
    borderRadius: 16,
    backgroundColor: "#FAFAFA",
    padding: 18,
    marginBottom: 18,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111111",
    marginBottom: 7,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#555555",
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  refreshButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D5D5D5",
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButtonText: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "700",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
    color: "#666666",
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111111",
    marginBottom: 8,
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 18,
    textAlign: "center",
  },
});
