import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTransporterOnboardingStatus,
  getTransporterProfile,
  updateTransporterProfile,
} from "../../src/api/transporter";
import { useAuthStore } from "../../src/auth/auth.store";
import { startContactChange } from "../../src/api/contact-change";
import { getDeviceCorrelationId } from "../../src/storage/device-correlation";

export function TransporterAccountScreen() {
  const user = useAuthStore((state) => state.user);
  const hydrate = useAuthStore((state) => state.hydrate);
  const queryClient = useQueryClient();

  const transporterId = user?.id ?? "";

  const profileQuery = useQuery({
    queryKey: ["transporter-profile", transporterId],
    queryFn: () => getTransporterProfile(transporterId),
    enabled: Boolean(transporterId),
  });

  const onboardingQuery = useQuery({
    queryKey: ["transporter-onboarding", transporterId],
    queryFn: () => getTransporterOnboardingStatus(transporterId),
    enabled: Boolean(transporterId),
  });
  const onboarding = onboardingQuery.data;

  const profile = profileQuery.data;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [businessRegistrationNumber, setBusinessRegistrationNumber] =
    useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");

  const [savingPersonal, setSavingPersonal] = useState(false);
  const [savingBusiness, setSavingBusiness] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? "");
      setLastName(user.lastName ?? "");
      setPhone(user.phone ?? "");
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      setCompanyName(profile.companyName ?? "");
      setBusinessRegistrationNumber(
        profile.businessRegistrationNumber ?? "",
      );
      setAddress(profile.address ?? "");
      setCity(profile.city ?? "");
      setState(profile.state ?? "");
      setCountry(profile.country ?? "");
    }
  }, [profile]);

  const handleSavePersonal = async () => {
    if (!user?.id) {
      Alert.alert("Session required", "Please sign in again.");
      return;
    }

    try {
      setSavingPersonal(true);

      const currentPhone = user.phone?.trim() ?? "";
      const requestedPhone = phone.trim();

      if (requestedPhone !== currentPhone && requestedPhone.length < 7) {
        Alert.alert("Invalid phone number", "Please enter a valid phone number.");
        return;
      }

      if (requestedPhone !== currentPhone) {
        const deviceCorrelationId = await getDeviceCorrelationId();

        await startContactChange({
          type: "PHONE",
          requestedValue: requestedPhone,
          deviceCorrelationId,
        });
      }

      await hydrate();

      if (requestedPhone !== currentPhone) {
        Alert.alert(
          "Identity verification required",
          "Your phone number change has been submitted for identity verification. Your current phone number remains unchanged until the verification process is completed.",
        );
      } else {
        Alert.alert("Saved", "Your personal details have been updated.");
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Unable to update your personal details.";
      Alert.alert("Update failed", message);
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleSaveBusiness = async () => {
    if (!transporterId) {
      Alert.alert("Session required", "Please sign in again.");
      return;
    }

    const values = {
      companyName: companyName.trim(),
      businessRegistrationNumber:
        businessRegistrationNumber.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      country: country.trim(),
    };

    const missing = Object.values(values).some((value) => !value);

    if (missing) {
      Alert.alert(
        "Profile incomplete",
        "Please complete all transporter profile fields.",
      );
      return;
    }

    try {
      setSavingBusiness(true);

      await updateTransporterProfile(transporterId, values);

      await queryClient.invalidateQueries({
        queryKey: ["transporter-profile", transporterId],
      });

      Alert.alert("Saved", "Your transporter profile has been updated.");
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Unable to update your transporter profile.";

      Alert.alert("Update failed", message);
    } finally {
      setSavingBusiness(false);
    }
  };

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Session unavailable</Text>
        <Text style={styles.errorText}>
          Please sign in again to access your account.
        </Text>
        <Pressable
          onPress={() => router.replace("/(auth)/sign-in")}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>SIGN IN</Text>
        </Pressable>
      </View>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4169E1" />
        <Text style={styles.loadingText}>Loading account...</Text>
      </View>
    );
  }

  if (profileQuery.isError || !profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Unable to load account</Text>
        <Text style={styles.errorText}>
          Your transporter profile could not be loaded.
        </Text>
        <Pressable
          onPress={() => void profileQuery.refetch()}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>TRY AGAIN</Text>
        </Pressable>
      </View>
    );
  }

  const verificationApproved =
    profile.verificationStatus === "APPROVED";

  const personalInformationLocked =
    Boolean(onboarding?.ninApproved || onboarding?.driversLicenseApproved);

  const businessInformationLocked =
    Boolean(onboarding?.adminApproved);

  return (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>

        <Text style={styles.eyebrow}>TRANSCONET</Text>
        <Text style={styles.title}>Account</Text>
        <Text style={styles.subtitle}>
          Manage your personal and transporter profile information.
        </Text>

        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View>
              <Text style={styles.statusLabel}>ACCOUNT STATUS</Text>
              <Text style={styles.statusValue}>
                {user.status ?? "ACTIVE"}
              </Text>
            </View>

            <View
              style={[
                styles.badge,
                verificationApproved
                  ? styles.badgeApproved
                  : styles.badgePending,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  verificationApproved
                    ? styles.badgeApprovedText
                    : styles.badgePendingText,
                ]}
              >
                {profile.verificationStatus}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {profile.tier2Approved ? "TIER 2" : "TIER 1"}
              </Text>
              <Text style={styles.statLabel}>TRANSPORTER TIER</Text>
            </View>

            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {profile.totalTrips}
              </Text>
              <Text style={styles.statLabel}>TOTAL TRIPS</Text>
            </View>

            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {Number(profile.rating || 0).toFixed(1)}
              </Text>
              <Text style={styles.statLabel}>RATING</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>PERSONAL INFORMATION</Text>



          <Text style={styles.label}>FIRST NAME</Text>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            editable={false}
            style={styles.readOnlyInput}
            autoCapitalize="words"
          />

          <Text style={styles.label}>LAST NAME</Text>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            editable={false}
            style={styles.readOnlyInput}
            autoCapitalize="words"
          />

          <Text style={styles.label}>EMAIL</Text>
          <View style={styles.readOnlyInput}>
            <Text style={styles.readOnlyText}>
              {user.email ?? "Not available"}
            </Text>
          </View>
          <Text style={styles.helper}>
            Email is managed through account verification and cannot be
            changed here.
          </Text>

          <Text style={styles.label}>PHONE</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            style={styles.input}
            editable={!savingPersonal && !personalInformationLocked}
            keyboardType="phone-pad"
          />

          {personalInformationLocked ? (
            <Text style={styles.notice}>
              Your verified personal information is locked after identity
              verification. Contact the TransConet Admin Management platform
              if a correction is required.
            </Text>
          ) : (
            <Pressable
              onPress={() => void handleSavePersonal()}
              disabled={savingPersonal}
              style={[
                styles.primaryButton,
                savingPersonal && styles.buttonDisabled,
              ]}
            >
              {savingPersonal ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  SAVE PERSONAL DETAILS
                </Text>
              )}
            </Pressable>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>TRANSPORTER PROFILE</Text>



          <Text style={styles.label}>COMPANY NAME</Text>
          <TextInput
            value={companyName}
            onChangeText={setCompanyName}
            style={styles.input}
            editable={!savingBusiness && !businessInformationLocked}
            autoCapitalize="words"
          />

          <Text style={styles.label}>
            BUSINESS REGISTRATION NUMBER
          </Text>
          <TextInput
            value={businessRegistrationNumber}
            onChangeText={setBusinessRegistrationNumber}
            style={styles.input}
            editable={!savingBusiness && !businessInformationLocked}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>ADDRESS</Text>
          <TextInput
            value={address}
            onChangeText={setAddress}
            style={[styles.input, styles.multiline]}
            editable={!savingBusiness}
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>CITY</Text>
          <TextInput
            value={city}
            onChangeText={setCity}
            style={styles.input}
            editable={!savingBusiness}
            autoCapitalize="words"
          />

          <Text style={styles.label}>STATE</Text>
          <TextInput
            value={state}
            onChangeText={setState}
            style={styles.input}
            editable={!savingBusiness}
            autoCapitalize="words"
          />

          <Text style={styles.label}>COUNTRY</Text>
          <TextInput
            value={country}
            onChangeText={setCountry}
            style={styles.input}
            editable={!savingBusiness}
            autoCapitalize="words"
          />

          <Text style={styles.notice}>
            Profile changes are recorded and communicated to the
            TransConet Admin Management platform in real time. Verification
            and Tier 2 approval remain controlled by administrators.
          </Text>

          <Pressable
            onPress={() => void handleSaveBusiness()}
            disabled={savingBusiness}
            style={[
              styles.primaryButton,
              savingBusiness && styles.buttonDisabled,
            ]}
          >
            {savingBusiness ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                SAVE TRANSPORTER PROFILE
              </Text>
            )}
          </Pressable>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F4F7FF",
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F4F7FF",
  },
  back: {
    alignSelf: "flex-start",
    color: "#4169E1",
    backgroundColor: "#EAF0FF",
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 20,
    overflow: "hidden",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.7,
    color: "#4169E1",
  },
  title: {
    marginTop: 5,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    color: "#101B3A",
  },
  subtitle: {
    marginTop: 7,
    marginBottom: 18,
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
  },
  statusCard: {
    padding: 21,
    marginBottom: 16,
    borderRadius: 22,
    backgroundColor: "#101B3A",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.17,
    shadowRadius: 15,
    elevation: 5,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusLabel: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: "#AEB9D5",
  },
  statusValue: {
    marginTop: 6,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  badge: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  badgeApproved: {
    backgroundColor: "#ECFDF3",
  },
  badgePending: {
    backgroundColor: "#FFF7E8",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  badgeApprovedText: {
    color: "#027A48",
  },
  badgePendingText: {
    color: "#B54708",
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#344263",
  },
  stat: {
    flex: 1,
  },
  statValue: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  statLabel: {
    marginTop: 5,
    fontSize: 8,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 0.7,
    color: "#AEB9D5",
  },
  card: {
    padding: 19,
    marginBottom: 16,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7F5",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  section: {
    marginBottom: 14,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: "#4169E1",
  },
  label: {
    marginTop: 12,
    marginBottom: 7,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
    color: "#475467",
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#D5DDF0",
    borderRadius: 13,
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#101B3A",
    backgroundColor: "#F9FAFF",
  },
  multiline: {
    minHeight: 92,
    paddingTop: 13,
    textAlignVertical: "top",
  },
  readOnlyInput: {
    minHeight: 50,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#E1E7F5",
    borderRadius: 13,
    backgroundColor: "#F4F6FA",
  },
  readOnlyText: {
    fontSize: 14,
    color: "#667085",
  },
  helper: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 17,
    color: "#98A2B3",
  },
  notice: {
    marginTop: 16,
    padding: 13,
    borderRadius: 13,
    backgroundColor: "#F4F7FF",
    borderWidth: 1,
    borderColor: "#DCE4F7",
    fontSize: 12,
    lineHeight: 18,
    color: "#475467",
  },
  primaryButton: {
    minHeight: 52,
    marginTop: 19,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4169E1",
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 7,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.6,
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
    textAlign: "center",
  },
  errorText: {
    marginTop: 8,
    marginBottom: 18,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
  },
});

export default TransporterAccountScreen;
