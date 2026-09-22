import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";

import { useAuthStore } from "../../src/auth/auth.store";
import {
  createTransporterDocument,
  getTransporterDocuments,
  getTransporterOnboardingStatus,
  getTransporterProfile,
  requestDocumentUploadUrl,
  startTransporterVerification,
  type TransporterDocument,
  type TransporterDocumentType,
  type TransporterVerification,
} from "../../src/api/transporter";

const VEHICLE_REGISTRATION: TransporterDocumentType =
  "VEHICLE_REGISTRATION";

type VerificationStatus = "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED";

function verificationStatus(
  verification?: TransporterVerification | null,
): VerificationStatus {
  if (!verification) return "NOT_SUBMITTED";

  if (
    verification.adminStatus === "APPROVED" &&
    verification.adminApproved === true
  ) {
    return "APPROVED";
  }

  if (verification.adminStatus === "REJECTED") {
    return "REJECTED";
  }

  return "PENDING";
}

function documentStatus(
  document?: TransporterDocument | null,
): VerificationStatus {
  if (!document) return "NOT_SUBMITTED";

  if (document.status === "APPROVED" || document.adminApproved) {
    return "APPROVED";
  }

  if (document.status === "REJECTED") {
    return "REJECTED";
  }

  return "PENDING";
}

function statusText(status: VerificationStatus) {
  switch (status) {
    case "APPROVED":
      return "APPROVED";
    case "PENDING":
      return "PENDING REVIEW";
    case "REJECTED":
      return "REJECTED";
    default:
      return "NOT SUBMITTED";
  }
}

function normalizeNin(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function normalizeDriversLicense(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

function normalizeBusinessNumber(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 30);
}

function validNin(value: string) {
  return /^\d{11}$/.test(value);
}

function validDriversLicense(value: string) {
  return /^[A-Z0-9]{1,12}$/.test(value);
}

function validBusinessNumber(value: string) {
  return /^(RC|BN|IT|LP|LLP)[A-Z0-9]+$/.test(value);
}

export default function TransporterDocumentsScreen() {
  const user = useAuthStore((state) => state.user);

  const [profileLoading, setProfileLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  const [transporterType, setTransporterType] = useState<
    "INDIVIDUAL" | "BUSINESS"
  >("INDIVIDUAL");

  const [nin, setNin] = useState("");
  const [driversLicense, setDriversLicense] = useState("");
  const [businessNumber, setBusinessNumber] = useState("");

  const [ninVerification, setNinVerification] =
    useState<TransporterVerification | null>(null);
  const [driversLicenseVerification, setDriversLicenseVerification] =
    useState<TransporterVerification | null>(null);
  const [businessVerification, setBusinessVerification] =
    useState<TransporterVerification | null>(null);

  const [documents, setDocuments] = useState<TransporterDocument[]>([]);

  const [submittingType, setSubmittingType] = useState<
    "NIN" | "DRIVERS_LICENSE" | "BUSINESS_REGISTRATION" | null
  >(null);

  const [uploading, setUploading] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      setProfileLoading(false);
      return;
    }

    try {
      const [profile, onboarding, transporterDocuments] = await Promise.all([
        getTransporterProfile(user.id),
        getTransporterOnboardingStatus(user.id),
        getTransporterDocuments(user.id),
      ]);

      setTransporterType(profile.transporterType ?? "INDIVIDUAL");

      if (profile.businessRegistrationNumber) {
        setBusinessNumber(
          normalizeBusinessNumber(profile.businessRegistrationNumber),
        );
      }

      setDocuments(transporterDocuments);

      /*
       * The onboarding endpoint is the authoritative persisted verification
       * summary. There is intentionally no GET /verifications endpoint.
       *
       * Rebuild the local verification state from the persisted per-check
       * submitted/approved flags so the status survives app reloads.
       */
      setNinVerification(
        onboarding.ninSubmitted
          ? ({
              type: "NIN",
              adminStatus: onboarding.ninApproved ? "APPROVED" : "PENDING",
              adminApproved: onboarding.ninApproved,
            } as TransporterVerification)
          : null,
      );

      setDriversLicenseVerification(
        onboarding.driversLicenseSubmitted
          ? ({
              type: "DRIVERS_LICENSE",
              adminStatus: onboarding.driversLicenseApproved
                ? "APPROVED"
                : "PENDING",
              adminApproved: onboarding.driversLicenseApproved,
            } as TransporterVerification)
          : null,
      );

      setBusinessVerification(
        onboarding.businessRegistrationSubmitted
          ? ({
              type: "BUSINESS_REGISTRATION",
              adminStatus: onboarding.businessRegistrationApproved
                ? "APPROVED"
                : "PENDING",
              adminApproved: onboarding.businessRegistrationApproved,
            } as TransporterVerification)
          : null,
      );
    } catch (error) {
      console.error("Failed to load transporter verification data:", error);

      Alert.alert(
        "Unable to load",
        "We could not load your transporter verification information. Please try again.",
      );
    } finally {
      setLoading(false);
      setProfileLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const vehicleRegistrationDocument = useMemo(
    () =>
      documents
        .filter((document) => document.type === VEHICLE_REGISTRATION)
        .sort((a, b) => {
          const aDate = a.createdAt ? Date.parse(a.createdAt) : 0;
          const bDate = b.createdAt ? Date.parse(b.createdAt) : 0;
          return bDate - aDate;
        })[0],
    [documents],
  );

  const ninStatus = verificationStatus(ninVerification);
  const driversLicenseStatus = verificationStatus(
    driversLicenseVerification,
  );
  const businessStatus = verificationStatus(businessVerification);
  const vehicleStatus = documentStatus(vehicleRegistrationDocument);

  const businessRequired = transporterType === "BUSINESS";

  const requiredChecksApproved =
    ninStatus === "APPROVED" &&
    driversLicenseStatus === "APPROVED" &&
    (!businessRequired || businessStatus === "APPROVED");

  const handleSubmitVerification = async (
    type: "NIN" | "DRIVERS_LICENSE" | "BUSINESS_REGISTRATION",
  ) => {
    if (!user?.id) {
      Alert.alert(
        "Session required",
        "Please sign in again before continuing.",
      );
      return;
    }

    let verificationNumber = "";

    if (type === "NIN") {
      verificationNumber = nin;

      if (!validNin(verificationNumber)) {
        Alert.alert(
          "Invalid NIN",
          "NIN must contain exactly 11 digits.",
        );
        return;
      }
    }

    if (type === "DRIVERS_LICENSE") {
      verificationNumber = driversLicense;

      if (!validDriversLicense(verificationNumber)) {
        Alert.alert(
          "Invalid Driver's License",
          "Enter the Driver's License number using letters and numbers only. Do not enter spaces or special characters.",
        );
        return;
      }
    }

    if (type === "BUSINESS_REGISTRATION") {
      verificationNumber = businessNumber;

      if (!validBusinessNumber(verificationNumber)) {
        Alert.alert(
          "Invalid Business Registration Number",
          "Use the registration prefix RC, BN, IT, LP, or LLP followed by the registration number, with no spaces or special characters.",
        );
        return;
      }
    }

    if (submittingType) return;

    try {
      setSubmittingType(type);

      const verification = await startTransporterVerification({
        transporterId: user.id,
        type,
        verificationNumber,
        subjectConsent: true,
      });

      if (type === "NIN") {
        setNinVerification(verification);
      } else if (type === "DRIVERS_LICENSE") {
        setDriversLicenseVerification(verification);
      } else {
        setBusinessVerification(verification);
      }

      await loadData();

      Alert.alert(
        "Verification submitted",
        "Your details have been sent for Youverify verification. Youverify success does not automatically approve your transporter account. An Administrator must make the final decision.",
      );
    } catch (error) {
      console.error("Transporter verification failed:", error);

      Alert.alert(
        "Verification failed",
        error instanceof Error
          ? error.message
          : "The verification request could not be submitted.",
      );
    } finally {
      setSubmittingType(null);
    }
  };

  const handleVehicleRegistrationUpload = async () => {
    if (!user?.id) {
      Alert.alert(
        "Session required",
        "Please sign in again before uploading your document.",
      );
      return;
    }

    if (uploading) return;

    try {
      setUploading(true);

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
        type: VEHICLE_REGISTRATION,
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
          uploadError || "The vehicle registration file could not be uploaded.",
        );
      }

      await createTransporterDocument({
        type: VEHICLE_REGISTRATION,
        storagePath: upload.storagePath,
      });

      await loadData();

      Alert.alert(
        "Vehicle registration submitted",
        "Your vehicle registration document has been uploaded and is now pending Administrator review.",
      );
    } catch (error) {
      console.error("Vehicle registration upload failed:", error);

      Alert.alert(
        "Upload failed",
        error instanceof Error
          ? error.message
          : "The vehicle registration document could not be uploaded.",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleContinue = async () => {
    if (!requiredChecksApproved) {
      Alert.alert(
        "Verification pending",
        "NIN, Driver's License, and Business Registration where required must all be approved by an Administrator before you continue.",
      );
      return;
    }

    if (vehicleStatus !== "APPROVED") {
      Alert.alert(
        "Vehicle registration pending",
        "Your vehicle registration document must be uploaded and approved by an Administrator before continuing.",
      );
      return;
    }

    router.replace(" /(transporter-onboarding)/vehicle".trim());
  };

  const renderStatus = (status: VerificationStatus) => (
    <View
      style={[
        styles.statusBadge,
        status === "APPROVED" && styles.statusApproved,
        status === "PENDING" && styles.statusPending,
        status === "REJECTED" && styles.statusRejected,
      ]}
    >
      <Text style={styles.statusText}>{statusText(status)}</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>TRANSCONET</Text>
          <Text style={styles.title}>Verification & Documents</Text>
          <Text style={styles.subtitle}>
            Enter your verification numbers and upload your vehicle
            registration document. Identity documents are verified by number;
            they are not uploaded here.
          </Text>
        </View>

        <View style={styles.progressRow}>
          <View style={styles.progressActive} />
          <View style={styles.progressActive} />
          <View style={styles.progressInactive} />
          <View style={styles.progressInactive} />
        </View>

        <Text style={styles.progressText}>STEP 2 OF 4</Text>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Important</Text>
          <Text style={styles.noticeText}>
            Youverify performs the verification check. A successful Youverify
            result does not automatically approve you. Final approval is made
            by a TransConet Administrator.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Identity verification</Text>
          <Text style={styles.cardDescription}>
            Enter the identification number exactly as issued. Do not upload
            identity documents for these checks.
          </Text>

          <View style={styles.fieldBlock}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>NIN</Text>
              {renderStatus(ninStatus)}
            </View>

            <TextInput
              value={nin}
              onChangeText={(value) => setNin(normalizeNin(value))}
              placeholder="11-digit NIN"
              keyboardType="number-pad"
              maxLength={11}
              autoCapitalize="none"
              autoCorrect={false}
              editable={ninStatus !== "APPROVED" && !Boolean(submittingType)}
              style={styles.input}
            />

            <Text style={styles.helper}>
              Exactly 11 digits. Numbers only.
            </Text>

            {ninStatus !== "APPROVED" ? (
              <Pressable
                style={[
                  styles.actionButton,
                  submittingType === "NIN" && styles.disabledButton,
                ]}
                onPress={() => void handleSubmitVerification("NIN")}
                disabled={Boolean(submittingType) || profileLoading}
              >
                {submittingType === "NIN" ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.actionButtonText}>
                    {ninStatus === "REJECTED"
                      ? "RETRY NIN VERIFICATION"
                      : "VERIFY NIN"}
                  </Text>
                )}
              </Pressable>
            ) : null}
          </View>

          <View style={styles.fieldBlock}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>DRIVER'S LICENSE</Text>
              {renderStatus(driversLicenseStatus)}
            </View>

            <TextInput
              value={driversLicense}
              onChangeText={(value) =>
                setDriversLicense(normalizeDriversLicense(value))
              }
              placeholder="Driver's License number"
              maxLength={12}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={
                driversLicenseStatus !== "APPROVED" &&
                !Boolean(submittingType)
              }
              style={styles.input}
            />

            <Text style={styles.helper}>
              Letters and numbers only. No spaces or special characters.
            </Text>

            {driversLicenseStatus !== "APPROVED" ? (
              <Pressable
                style={[
                  styles.actionButton,
                  submittingType === "DRIVERS_LICENSE" &&
                    styles.disabledButton,
                ]}
                onPress={() =>
                  void handleSubmitVerification("DRIVERS_LICENSE")
                }
                disabled={Boolean(submittingType) || profileLoading}
              >
                {submittingType === "DRIVERS_LICENSE" ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.actionButtonText}>
                    {driversLicenseStatus === "REJECTED"
                      ? "RETRY LICENSE VERIFICATION"
                      : "VERIFY DRIVER'S LICENSE"}
                  </Text>
                )}
              </Pressable>
            ) : null}
          </View>

          {businessRequired ? (
            <View style={styles.fieldBlock}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>
                  BUSINESS REGISTRATION NUMBER
                </Text>
                {renderStatus(businessStatus)}
              </View>

              <TextInput
                value={businessNumber}
                onChangeText={(value) =>
                  setBusinessNumber(normalizeBusinessNumber(value))
                }
                placeholder="RC / BN / IT / LP / LLP number"
                maxLength={30}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={
                  businessStatus !== "APPROVED" &&
                  !Boolean(submittingType)
                }
                style={styles.input}
              />

              <Text style={styles.helper}>
                Use RC, BN, IT, LP, or LLP followed by the registration number.
                No spaces or special characters.
              </Text>

              {businessStatus !== "APPROVED" ? (
                <Pressable
                  style={[
                    styles.actionButton,
                    submittingType === "BUSINESS_REGISTRATION" &&
                      styles.disabledButton,
                  ]}
                  onPress={() =>
                    void handleSubmitVerification("BUSINESS_REGISTRATION")
                  }
                  disabled={Boolean(submittingType) || profileLoading}
                >
                  {submittingType === "BUSINESS_REGISTRATION" ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.actionButtonText}>
                      {businessStatus === "REJECTED"
                        ? "RETRY BUSINESS VERIFICATION"
                        : "VERIFY BUSINESS"}
                    </Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vehicle registration</Text>
          <Text style={styles.cardDescription}>
            Vehicle registration is the only required document on this screen.
            Upload the actual registration file for Administrator review.
          </Text>

          <View style={styles.vehicleStatusRow}>
            <Text style={styles.documentName}>
              Vehicle Registration
            </Text>
            {renderStatus(vehicleStatus)}
          </View>

          {vehicleRegistrationDocument?.rejectionReason ? (
            <Text style={styles.rejectionText}>
              Rejection reason:{" "}
              {vehicleRegistrationDocument.rejectionReason}
            </Text>
          ) : null}

          {vehicleStatus !== "APPROVED" ? (
            <Pressable
              style={[
                styles.uploadButton,
                uploading && styles.disabledButton,
              ]}
              onPress={() => void handleVehicleRegistrationUpload()}
              disabled={uploading || loading}
            >
              {uploading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.actionButtonText}>
                  {vehicleStatus === "REJECTED"
                    ? "REUPLOAD VEHICLE REGISTRATION"
                    : "UPLOAD VEHICLE REGISTRATION"}
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>

        <View style={styles.requirementCard}>
          <Text style={styles.requirementTitle}>Before continuing</Text>

          <Text style={styles.requirementItem}>
            {ninStatus === "APPROVED" ? "✓" : "○"} NIN approved
          </Text>

          <Text style={styles.requirementItem}>
            {driversLicenseStatus === "APPROVED" ? "✓" : "○"} Driver's
            License approved
          </Text>

          {businessRequired ? (
            <Text style={styles.requirementItem}>
              {businessStatus === "APPROVED" ? "✓" : "○"} Business
              Registration approved
            </Text>
          ) : null}

          <Text style={styles.requirementItem}>
            {vehicleStatus === "APPROVED" ? "✓" : "○"} Vehicle Registration
            approved
          </Text>
        </View>

        <Pressable
          style={[
            styles.continueButton,
            (!requiredChecksApproved || vehicleStatus !== "APPROVED") &&
              styles.disabledButton,
          ]}
          onPress={() => void handleContinue()}
          disabled={
            loading ||
            !requiredChecksApproved ||
            vehicleStatus !== "APPROVED"
          }
        >
          <Text style={styles.continueButtonText}>
            CONTINUE TO VEHICLE
          </Text>
        </Pressable>

        <Pressable
          style={styles.exitButton}
          onPress={() => router.replace("/(transporter)")}
        >
          <Text style={styles.exitButtonText}>EXIT SETUP</Text>
        </Pressable>
      </ScrollView>
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
    paddingTop: 22,
    paddingBottom: 52,
  },

  header: {
    marginBottom: 20,
  },

  eyebrow: {
    alignSelf: "flex-start",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#E7EDFF",
    overflow: "hidden",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2.2,
    color: "#4169E1",
    marginBottom: 15,
  },

  title: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "900",
    color: "#101B3A",
    letterSpacing: -0.5,
    marginBottom: 9,
  },

  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: "#667085",
  },

  progressRow: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 9,
  },

  progressActive: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#4169E1",
  },

  progressInactive: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#D8E0F2",
  },

  progressText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
    color: "#4169E1",
    marginBottom: 20,
  },

  notice: {
    borderWidth: 1,
    borderColor: "#D9E3FA",
    borderRadius: 18,
    paddingHorizontal: 17,
    paddingVertical: 16,
    marginBottom: 16,
    backgroundColor: "#EEF3FF",
  },

  noticeTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#203A78",
    marginBottom: 6,
  },

  noticeText: {
    fontSize: 12.5,
    lineHeight: 20,
    color: "#5F6F8F",
  },

  card: {
    borderWidth: 1,
    borderColor: "#E1E7F2",
    borderRadius: 22,
    paddingHorizontal: 17,
    paddingVertical: 19,
    marginBottom: 16,
    backgroundColor: "#FFFFFF",
    shadowColor: "#101B3A",
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },

  cardTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    color: "#101B3A",
    marginBottom: 7,
  },

  cardDescription: {
    fontSize: 12.5,
    lineHeight: 20,
    color: "#667085",
    marginBottom: 17,
  },

  fieldBlock: {
    borderTopWidth: 1,
    borderTopColor: "#EDF0F6",
    paddingTop: 17,
    marginTop: 5,
    marginBottom: 18,
  },

  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 9,
  },

  inputLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.9,
    color: "#52617B",
  },

  input: {
    height: 54,
    borderWidth: 1,
    borderColor: "#D8E0EE",
    borderRadius: 14,
    paddingHorizontal: 15,
    fontSize: 15,
    fontWeight: "600",
    color: "#101B3A",
    backgroundColor: "#FBFCFF",
  },

  helper: {
    fontSize: 11.5,
    lineHeight: 18,
    color: "#7A8498",
    marginTop: 7,
    marginBottom: 12,
  },

  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#EEF1F6",
    borderWidth: 1,
    borderColor: "#E1E6EF",
  },

  statusApproved: {
    backgroundColor: "#EAF8F0",
    borderColor: "#BCE6CE",
  },

  statusPending: {
    backgroundColor: "#FFF6DD",
    borderColor: "#F1DFA6",
  },

  statusRejected: {
    backgroundColor: "#FDECEC",
    borderColor: "#F3C8C8",
  },

  statusText: {
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 0.55,
    color: "#344054",
  },

  actionButton: {
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: "#4169E1",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    shadowColor: "#4169E1",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 2,
  },

  uploadButton: {
    minHeight: 50,
    borderRadius: 13,
    backgroundColor: "#4169E1",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    marginTop: 15,
    shadowColor: "#4169E1",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 2,
  },

  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "900",
    letterSpacing: 0.55,
    textAlign: "center",
  },

  disabledButton: {
    opacity: 0.48,
  },

  vehicleStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 3,
  },

  documentName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    color: "#101B3A",
  },

  rejectionText: {
    color: "#B42318",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#FFF2F2",
  },

  requirementCard: {
    borderWidth: 1,
    borderColor: "#DCE5FA",
    borderRadius: 20,
    paddingHorizontal: 17,
    paddingVertical: 18,
    marginBottom: 17,
    backgroundColor: "#F8FAFF",
  },

  requirementTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#203A78",
    marginBottom: 13,
  },

  requirementItem: {
    fontSize: 13,
    lineHeight: 20,
    color: "#52617B",
    marginBottom: 8,
    fontWeight: "600",
  },

  continueButton: {
    minHeight: 56,
    borderRadius: 15,
    backgroundColor: "#4169E1",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    shadowColor: "#4169E1",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },

  continueButtonText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  exitButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },

  exitButtonText: {
    color: "#667085",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
