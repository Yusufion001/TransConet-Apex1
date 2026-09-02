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
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";

import { useAuthStore } from "../../src/auth/auth.store";
import {
  createTransporterDocument,
  getTransporterDocuments,
  requestDocumentUploadUrl,
  type TransporterDocument,
  type TransporterDocumentType,
} from "../../src/api/transporter";

type Tier2Document = {
  type: "INSURANCE" | "BUSINESS_DOCUMENT";
  title: string;
  description: string;
};

const TIER_2_DOCUMENTS: Tier2Document[] = [
  {
    type: "INSURANCE",
    title: "Insurance Certificate",
    description:
      "Upload your valid insurance certificate covering your transport operations.",
  },
  {
    type: "BUSINESS_DOCUMENT",
    title: "Business Certificate",
    description:
      "Upload your valid business registration or certificate of incorporation.",
  },
];

function getStatusLabel(document?: TransporterDocument) {
  if (!document) return "NOT SUBMITTED";

  if (document.status === "APPROVED" && document.adminApproved) {
    return "APPROVED";
  }

  if (document.status === "REJECTED") {
    return "REJECTED";
  }

  return "PENDING";
}

export default function Tier2DocumentsScreen() {
  const user = useAuthStore((state) => state.user);

  const [documents, setDocuments] = useState<TransporterDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingType, setUploadingType] =
    useState<TransporterDocumentType | null>(null);

  const loadDocuments = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const result = await getTransporterDocuments(user.id);
      setDocuments(result);
    } catch (error) {
      console.error("Failed to load Tier 2 documents:", error);
      Alert.alert(
        "Unable to load documents",
        "We could not load your Tier 2 documents. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const documentsByType = useMemo(() => {
    const map = new Map<TransporterDocumentType, TransporterDocument>();

    for (const document of documents) {
      map.set(document.type, document);
    }

    return map;
  }, [documents]);

  const approvedCount = TIER_2_DOCUMENTS.filter((item) => {
    const document = documentsByType.get(item.type);
    return document?.status === "APPROVED" && document.adminApproved;
  }).length;

  const submittedCount = TIER_2_DOCUMENTS.filter((item) =>
    documentsByType.has(item.type),
  ).length;

  const handleUpload = async (requiredDocument: Tier2Document) => {
    if (!user?.id) {
      Alert.alert("Session required", "Please sign in again and continue setup.");
      return;
    }

    if (uploadingType) return;

    try {
      setUploadingType(requiredDocument.type);

      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];

      const upload = await requestDocumentUploadUrl({
        type: requiredDocument.type,
        fileName: asset.name,
      });

      const fileResponse = await fetch(asset.uri);

      if (!fileResponse.ok) {
        throw new Error("Unable to read the selected file.");
      }

      const fileBlob = await fileResponse.blob();

      const uploadResponse = await fetch(upload.signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type":
            asset.mimeType || "application/octet-stream",
        },
        body: fileBlob,
      });

      if (!uploadResponse.ok) {
        const uploadError = await uploadResponse.text().catch(() => "");
        throw new Error(
          uploadError || "The file could not be uploaded.",
        );
      }

      await createTransporterDocument({
        type: requiredDocument.type,
        storagePath: upload.storagePath,
      });

      await loadDocuments();

      Alert.alert(
        "Document submitted",
        `${requiredDocument.title} has been uploaded and is now pending review.`,
      );
    } catch (error) {
      console.error("Tier 2 document upload failed:", error);

      const message =
        error instanceof Error
          ? error.message
          : "The document could not be uploaded.";

      Alert.alert("Upload failed", message);
    } finally {
      setUploadingType(null);
    }
  };

  const handleContinue = () => {
    if (approvedCount !== TIER_2_DOCUMENTS.length) {
      Alert.alert(
        "Documents pending",
        "Both Tier 2 documents must be approved before continuing.",
      );
      return;
    }

    router.replace("/(transporter-onboarding)/tier2-review");
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>TRANSCONET</Text>
          <Text style={styles.title}>Tier 2 verification</Text>
          <Text style={styles.subtitle}>
            Tier 2 is for transporters approved to handle highly valuable
            goods. Submit your insurance and business certificates for review.
          </Text>
        </View>

        <View style={styles.progressRow}>
          <View style={styles.progressStepActive} />
          <View style={styles.progressStepActive} />
          <View style={styles.progressStepActive} />
          <View style={styles.progressStepActive} />
        </View>

        <Text style={styles.progressText}>TIER 2 • DOCUMENTS</Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Tier 2 approval</Text>
          <Text style={styles.infoText}>
            Upload both documents. Submission does not automatically grant
            Tier 2 status. An administrator must review the documents and
            explicitly approve your Tier 2 access.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>Required documents</Text>
              <Text style={styles.cardDescription}>
                {submittedCount} of {TIER_2_DOCUMENTS.length} submitted •{" "}
                {approvedCount} approved
              </Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>Loading documents...</Text>
            </View>
          ) : (
            TIER_2_DOCUMENTS.map((requiredDocument) => {
              const document = documentsByType.get(requiredDocument.type);
              const status = getStatusLabel(document);
              const isUploading = uploadingType === requiredDocument.type;

              return (
                <View key={requiredDocument.type} style={styles.documentRow}>
                  <View style={styles.documentInfo}>
                    <Text style={styles.documentTitle}>
                      {requiredDocument.title}
                    </Text>

                    <Text style={styles.documentDescription}>
                      {requiredDocument.description}
                    </Text>

                    <View
                      style={[
                        styles.statusBadge,
                        status === "APPROVED" && styles.statusApproved,
                        status === "REJECTED" && styles.statusRejected,
                        status === "PENDING" && styles.statusPending,
                      ]}
                    >
                      <Text style={styles.statusText}>{status}</Text>
                    </View>

                    {document?.status === "REJECTED" &&
                    document.rejectionReason ? (
                      <Text style={styles.rejectionText}>
                        Reason: {document.rejectionReason}
                      </Text>
                    ) : null}
                  </View>

                  {status !== "APPROVED" ? (
                    <Pressable
                      style={[
                        styles.uploadButton,
                        isUploading && styles.buttonDisabled,
                      ]}
                      onPress={() => void handleUpload(requiredDocument)}
                      disabled={Boolean(uploadingType)}
                    >
                      {isUploading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.uploadButtonText}>
                          {status === "REJECTED" ? "RETRY" : "UPLOAD"}
                        </Text>
                      )}
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        <Pressable
          style={[
            styles.continueButton,
            (loading || approvedCount !== TIER_2_DOCUMENTS.length) &&
              styles.buttonDisabled,
          ]}
          onPress={handleContinue}
          disabled={loading || approvedCount !== TIER_2_DOCUMENTS.length}
        >
          <Text style={styles.continueButtonText}>
            Continue to Tier 2 review
          </Text>
        </Pressable>

        <Pressable
          style={styles.refreshButton}
          onPress={() => {
            setLoading(true);
            void loadDocuments();
          }}
        >
          <Text style={styles.refreshButtonText}>Refresh document status</Text>
        </Pressable>
      </ScrollView>
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
    gap: 6,
    marginBottom: 8,
  },
  progressStepActive: {
    flex: 1,
    height: 5,
    borderRadius: 4,
    backgroundColor: "#111111",
  },
  progressStep: {
    flex: 1,
    height: 5,
    borderRadius: 4,
    backgroundColor: "#E5E5E5",
  },
  progressText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#777777",
    marginBottom: 24,
  },
  infoCard: {
    borderWidth: 1,
    borderColor: "#D9D9D9",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    backgroundColor: "#FAFAFA",
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111111",
    marginBottom: 7,
  },
  infoText: {
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
  cardHeader: {
    marginBottom: 8,
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
  },
  documentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    paddingTop: 16,
    marginTop: 16,
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111111",
    marginBottom: 5,
  },
  documentDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: "#666666",
    marginBottom: 9,
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: "#EEEEEE",
  },
  statusApproved: {
    backgroundColor: "#E6F4EA",
  },
  statusRejected: {
    backgroundColor: "#FDE8E8",
  },
  statusPending: {
    backgroundColor: "#FFF4D6",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#333333",
  },
  rejectionText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#B42318",
    marginTop: 8,
  },
  uploadButton: {
    minWidth: 78,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  continueButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  continueButtonText: {
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
  buttonDisabled: {
    opacity: 0.45,
  },
  loading: {
    alignItems: "center",
    paddingVertical: 28,
  },
  loadingText: {
    marginTop: 10,
    color: "#666666",
  },
});
