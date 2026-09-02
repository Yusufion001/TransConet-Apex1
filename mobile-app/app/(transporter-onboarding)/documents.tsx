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

type RequiredDocument = {
  type: TransporterDocumentType;
  title: string;
  description: string;
};

const REQUIRED_DOCUMENTS: RequiredDocument[] = [
  {
    type: "IDENTITY_DOCUMENT",
    title: "Identity Document",
    description: "Upload your valid identity document.",
  },
  {
    type: "DRIVERS_LICENSE",
    title: "Driver's License",
    description: "Upload your valid driver's license.",
  },
  {
    type: "VEHICLE_REGISTRATION",
    title: "Vehicle Registration",
    description: "Upload the registration document for your vehicle.",
  },
];

function getStatusLabel(document?: TransporterDocument) {
  if (!document) return "NOT SUBMITTED";

  if (document.status === "APPROVED" || document.adminApproved) {
    return "APPROVED";
  }

  if (document.status === "REJECTED") {
    return "REJECTED";
  }

  return "PENDING";
}

export default function TransporterDocumentsScreen() {
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
      console.error("Failed to load transporter documents:", error);
      Alert.alert(
        "Unable to load documents",
        "We could not load your submitted documents. Please try again.",
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

  const approvedCount = REQUIRED_DOCUMENTS.filter((item) => {
    const document = documentsByType.get(item.type);
    return document?.status === "APPROVED" || document?.adminApproved;
  }).length;

  const handleUpload = async (requiredDocument: RequiredDocument) => {
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
      console.error("Document upload failed:", error);

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
    if (approvedCount < REQUIRED_DOCUMENTS.length) {
      Alert.alert(
        "Documents pending",
        "Your submitted documents must be approved before continuing to the next onboarding step.",
      );
      return;
    }

    router.replace("/(transporter-onboarding)/vehicle");
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>TRANSCONET</Text>
          <Text style={styles.title}>Your documents</Text>
          <Text style={styles.subtitle}>
            Submit the documents required to complete your transporter
            verification.
          </Text>
        </View>

        <View style={styles.progressRow}>
          <View style={styles.progressStepActive} />
          <View style={styles.progressStepActive} />
          <View style={styles.progressStep} />
          <View style={styles.progressStep} />
        </View>

        <Text style={styles.progressText}>STEP 2 OF 4</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tier 1 documents</Text>
          <Text style={styles.cardDescription}>
            Each document will be reviewed before your transporter account can
            proceed to the next stage.
          </Text>

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>Loading documents...</Text>
            </View>
          ) : (
            REQUIRED_DOCUMENTS.map((requiredDocument) => {
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
                        {document.rejectionReason}
                      </Text>
                    ) : null}
                  </View>

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
                </View>
              );
            })
          )}
        </View>

        <Pressable
          style={[
            styles.continueButton,
            (loading || approvedCount < REQUIRED_DOCUMENTS.length) &&
              styles.buttonDisabled,
          ]}
          onPress={handleContinue}
          disabled={
            loading || approvedCount < REQUIRED_DOCUMENTS.length
          }
        >
          <Text style={styles.continueButtonText}>
            Continue to vehicle
          </Text>
        </Pressable>

        <Pressable
          style={styles.exitButton}
          onPress={() => router.replace("/(transporter)")}
        >
          <Text style={styles.exitButtonText}>Exit setup</Text>
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
    gap: 8,
    marginBottom: 8,
  },
  progressStep: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#E5E5E5",
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
  card: {
    borderWidth: 1,
    borderColor: "#E7E7E7",
    borderRadius: 16,
    padding: 18,
    backgroundColor: "#FFFFFF",
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#111111",
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: "#666666",
    marginBottom: 18,
  },
  loading: {
    paddingVertical: 30,
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: "#777777",
  },
  documentRow: {
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    paddingVertical: 18,
    gap: 14,
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
    color: "#707070",
    marginBottom: 10,
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: "#F1F1F1",
  },
  statusApproved: {
    backgroundColor: "#E8F5E9",
  },
  statusRejected: {
    backgroundColor: "#FDECEC",
  },
  statusPending: {
    backgroundColor: "#FFF5D6",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
    color: "#333333",
  },
  rejectionText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#B42318",
    marginTop: 8,
  },
  uploadButton: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  uploadButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  continueButton: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
  },
  continueButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  exitButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    marginTop: 8,
  },
  exitButtonText: {
    color: "#666666",
    fontSize: 13,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.45,
  },
});
