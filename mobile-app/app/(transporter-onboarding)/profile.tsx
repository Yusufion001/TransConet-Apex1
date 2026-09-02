import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { createTransporterProfile } from "../../src/api/transporter";
import { useAuthStore } from "../../src/auth/auth.store";

export default function TransporterProfileSetupScreen() {
  const user = useAuthStore((state) => state.user);

  const [companyName, setCompanyName] = useState("");
  const [businessRegistrationNumber, setBusinessRegistrationNumber] =
    useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    const values = {
      companyName: companyName.trim(),
      businessRegistrationNumber: businessRegistrationNumber.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      country: country.trim(),
    };

    const missing = Object.entries(values).some(([, value]) => !value);

    if (missing) {
      Alert.alert(
        "Profile incomplete",
        "Please complete all profile fields before continuing.",
      );
      return;
    }

    if (!user?.id) {
      Alert.alert(
        "Session required",
        "Your transporter session could not be found. Please sign in again.",
      );
      return;
    }

    try {
      setLoading(true);

      await createTransporterProfile(values);

      router.replace("/(transporter-onboarding)/documents");
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Unable to save your transporter profile. Please try again.";

      Alert.alert("Profile setup failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.progressRow}>
            <View style={[styles.progressDot, styles.progressActive]} />
            <View style={styles.progressLine} />
            <View style={styles.progressDot} />
            <View style={styles.progressLine} />
            <View style={styles.progressDot} />
            <View style={styles.progressLine} />
            <View style={styles.progressDot} />
          </View>

          <Text style={styles.step}>STEP 1 OF 4</Text>

          <View style={styles.content}>
            <Text style={styles.brand}>TRANSCONET</Text>
            <Text style={styles.title}>Set up your transporter profile.</Text>
            <Text style={styles.subtitle}>
              Tell us about the business or transport operation you represent.
            </Text>

            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>Why we need this</Text>
              <Text style={styles.noticeText}>
                Your profile information will be reviewed as part of transporter
                verification.
              </Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>COMPANY NAME</Text>
              <TextInput
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="Company or business name"
                placeholderTextColor="#999999"
                autoCapitalize="words"
                style={styles.input}
                editable={!loading}
              />

              <Text style={styles.label}>BUSINESS REGISTRATION NUMBER</Text>
              <TextInput
                value={businessRegistrationNumber}
                onChangeText={setBusinessRegistrationNumber}
                placeholder="Registration number"
                placeholderTextColor="#999999"
                autoCapitalize="characters"
                style={styles.input}
                editable={!loading}
              />

              <Text style={styles.label}>ADDRESS</Text>
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder="Business or operating address"
                placeholderTextColor="#999999"
                style={[styles.input, styles.multiline]}
                multiline
                editable={!loading}
              />

              <Text style={styles.label}>CITY</Text>
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="City"
                placeholderTextColor="#999999"
                autoCapitalize="words"
                style={styles.input}
                editable={!loading}
              />

              <Text style={styles.label}>STATE</Text>
              <TextInput
                value={state}
                onChangeText={setState}
                placeholder="State"
                placeholderTextColor="#999999"
                autoCapitalize="words"
                style={styles.input}
                editable={!loading}
              />

              <Text style={styles.label}>COUNTRY</Text>
              <TextInput
                value={country}
                onChangeText={setCountry}
                placeholder="Country"
                placeholderTextColor="#999999"
                autoCapitalize="words"
                style={styles.input}
                editable={!loading}
              />

              <Pressable
                onPress={() => void handleContinue()}
                disabled={loading}
                style={[styles.button, loading && styles.buttonDisabled]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>CONTINUE TO DOCUMENTS</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => router.replace("/(transporter)")}
                disabled={loading}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryText}>Exit setup</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  keyboard: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 48,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#D9D9D9",
  },
  progressActive: {
    backgroundColor: "#111111",
  },
  progressLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#D9D9D9",
    marginHorizontal: 6,
  },
  step: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: "#777777",
    marginBottom: 18,
  },
  content: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  brand: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#111111",
    marginBottom: 18,
  },
  title: {
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "800",
    color: "#111111",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: "#666666",
    marginBottom: 24,
  },
  notice: {
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 12,
    padding: 16,
    marginBottom: 26,
    backgroundColor: "#FAFAFA",
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111111",
    marginBottom: 5,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#666666",
  },
  form: {
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: "#555555",
    marginTop: 10,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#D8D8D8",
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 15,
    color: "#111111",
    backgroundColor: "#FFFFFF",
  },
  multiline: {
    minHeight: 90,
    paddingTop: 14,
    textAlignVertical: "top",
  },
  button: {
    minHeight: 54,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111111",
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: 18,
  },
  secondaryText: {
    color: "#666666",
    fontSize: 13,
    fontWeight: "600",
  },
});
