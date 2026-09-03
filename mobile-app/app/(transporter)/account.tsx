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
  getTransporterProfile,
  updateTransporterProfile,
} from "../../src/api/transporter";
import { updateCurrentUser } from "../../src/api/auth";
import { useAuthStore } from "../../src/auth/auth.store";

export default function TransporterAccountScreen() {
  const user = useAuthStore((state) => state.user);
  const hydrate = useAuthStore((state) => state.hydrate);
  const queryClient = useQueryClient();

  const transporterId = user?.id ?? "";

  const profileQuery = useQuery({
    queryKey: ["transporter-profile", transporterId],
    queryFn: () => getTransporterProfile(transporterId),
    enabled: Boolean(transporterId),
  });

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

    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      Alert.alert(
        "Invalid details",
        "First name and last name must contain at least 2 characters.",
      );
      return;
    }

    try {
      setSavingPersonal(true);

      await updateCurrentUser(user.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
      });

      await hydrate();

      Alert.alert("Saved", "Your personal details have been updated.");
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
        <ActivityIndicator size="large" color="#0B63CE" />
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
            style={styles.input}
            editable={!savingPersonal}
            autoCapitalize="words"
          />

          <Text style={styles.label}>LAST NAME</Text>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            style={styles.input}
            editable={!savingPersonal}
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
            editable={!savingPersonal}
            keyboardType="phone-pad"
          />

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
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>TRANSPORTER PROFILE</Text>

          <Text style={styles.label}>COMPANY NAME</Text>
          <TextInput
            value={companyName}
            onChangeText={setCompanyName}
            style={styles.input}
            editable={!savingBusiness}
            autoCapitalize="words"
          />

          <Text style={styles.label}>
            BUSINESS REGISTRATION NUMBER
          </Text>
          <TextInput
            value={businessRegistrationNumber}
            onChangeText={setBusinessRegistrationNumber}
            style={styles.input}
            editable={!savingBusiness}
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

        <View style={styles.card}>
          <Text style={styles.section}>ACCOUNT SECURITY</Text>

          <Pressable
            onPress={() => router.push("/(auth)/forgot-password")}
            style={styles.securityButton}
          >
            <View style={styles.securityCopy}>
              <Text style={styles.securityTitle}>Change password</Text>
              <Text style={styles.securityText}>
                Start the secure password reset process.
              </Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  container: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 50,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F5F7FA",
  },
  back: {
    marginTop: 10,
    color: "#0B63CE",
    fontSize: 16,
    fontWeight: "700",
  },
  eyebrow: {
    marginTop: 28,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#0B63CE",
  },
  title: {
    marginTop: 5,
    fontSize: 30,
    fontWeight: "800",
    color: "#101828",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 15,
    lineHeight: 21,
    color: "#667085",
  },
  statusCard: {
    padding: 20,
    marginBottom: 16,
    borderRadius: 18,
    backgroundColor: "#101828",
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#98A2B3",
  },
  statusValue: {
    marginTop: 5,
    fontSize: 20,
    fontWeight: "800",
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
    backgroundColor: "#FFFAEB",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
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
    borderTopColor: "#344054",
  },
  stat: {
    flex: 1,
  },
  statValue: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  statLabel: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: "#98A2B3",
  },
  card: {
    padding: 20,
    marginBottom: 16,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
  },
  section: {
    marginBottom: 12,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.3,
    color: "#667085",
  },
  label: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#475467",
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#101828",
    backgroundColor: "#FFFFFF",
  },
  multiline: {
    minHeight: 88,
    paddingTop: 13,
  },
  readOnlyInput: {
    minHeight: 50,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
  },
  readOnlyText: {
    fontSize: 15,
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
    borderRadius: 10,
    backgroundColor: "#F2F4F7",
    fontSize: 12,
    lineHeight: 18,
    color: "#475467",
  },
  primaryButton: {
    minHeight: 52,
    marginTop: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111111",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  securityButton: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F2F4F7",
  },
  securityCopy: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#344054",
  },
  securityText: {
    marginTop: 4,
    fontSize: 12,
    color: "#667085",
  },
  arrow: {
    marginLeft: 12,
    fontSize: 25,
    color: "#98A2B3",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#667085",
  },
  errorTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#101828",
  },
  errorText: {
    marginTop: 8,
    marginBottom: 18,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    color: "#667085",
  },
});
