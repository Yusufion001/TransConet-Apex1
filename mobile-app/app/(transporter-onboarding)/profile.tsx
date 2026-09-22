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

  const [transporterType, setTransporterType] = useState<
    "INDIVIDUAL" | "BUSINESS"
  >("INDIVIDUAL");
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
      transporterType,
      ...(transporterType === "BUSINESS"
        ? {
            companyName: companyName.trim(),
            businessRegistrationNumber: businessRegistrationNumber.trim(),
          }
        : {}),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      country: country.trim(),
    };

    const requiredValues = [
      values.address,
      values.city,
      values.state,
      values.country,
    ];

    if (transporterType === "BUSINESS") {
      requiredValues.push(
        companyName.trim(),
        businessRegistrationNumber.trim(),
      );
    }

    const missing = requiredValues.some((value) => !value);

    if (missing) {
      Alert.alert(
        "Profile incomplete",
        transporterType === "BUSINESS"
          ? "Please complete all business and profile fields before continuing."
          : "Please complete all profile fields before continuing.",
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
              Tell us how you are registering and where you operate.
            </Text>

            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>Why we need this</Text>
              <Text style={styles.noticeText}>
                Your profile information will be reviewed as part of transporter
                verification.
              </Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>HOW ARE YOU REGISTERING?</Text>
              <View style={styles.typeRow}>
                <Pressable
                  onPress={() => setTransporterType("INDIVIDUAL")}
                  disabled={loading}
                  style={[
                    styles.typeOption,
                    transporterType === "INDIVIDUAL" && styles.typeOptionActive,
                  ]}
                >
                  <View
                    style={[
                      styles.radio,
                      transporterType === "INDIVIDUAL" && styles.radioActive,
                    ]}
                  />
                  <Text style={styles.typeText}>Individual Transporter</Text>
                </Pressable>

                <Pressable
                  onPress={() => setTransporterType("BUSINESS")}
                  disabled={loading}
                  style={[
                    styles.typeOption,
                    transporterType === "BUSINESS" && styles.typeOptionActive,
                  ]}
                >
                  <View
                    style={[
                      styles.radio,
                      transporterType === "BUSINESS" && styles.radioActive,
                    ]}
                  />
                  <Text style={styles.typeText}>Registered Business</Text>
                </Pressable>
              </View>

              {transporterType === "BUSINESS" && (
                <>
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
                </>
              )}

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
                  <Text style={styles.buttonText}>CONTINUE</Text>
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
    backgroundColor: "#F4F7FF",
  },

  keyboard: {
    flex: 1,
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 48,
  },

  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    paddingHorizontal: 2,
  },

  progressDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#D8E0F2",
    borderWidth: 2,
    borderColor: "#D8E0F2",
  },

  progressActive: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#4169E1",
    borderColor: "#4169E1",
    shadowColor: "#4169E1",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 2,
  },

  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#D8E0F2",
    marginHorizontal: 7,
  },

  step: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#4169E1",
    marginBottom: 18,
  },

  content: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },

  brand: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#E7EDFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2.2,
    color: "#4169E1",
    overflow: "hidden",
    marginBottom: 16,
  },

  title: {
    fontSize: 31,
    lineHeight: 39,
    fontWeight: "900",
    color: "#101B3A",
    letterSpacing: -0.6,
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: "#667085",
    marginBottom: 22,
  },

  notice: {
    borderWidth: 1,
    borderColor: "#DCE5FA",
    borderRadius: 18,
    paddingHorizontal: 17,
    paddingVertical: 16,
    marginBottom: 24,
    backgroundColor: "#EEF3FF",
  },

  noticeTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#203A78",
    marginBottom: 6,
  },

  noticeText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#5F6F8F",
  },

  form: {
    gap: 9,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F5",
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 20,
    shadowColor: "#101B3A",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 3,
  },

  typeRow: {
    gap: 10,
    marginBottom: 6,
  },

  typeOption: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: "#DCE3F1",
    borderRadius: 15,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  typeOptionActive: {
    borderColor: "#4169E1",
    backgroundColor: "#F1F5FF",
    shadowColor: "#4169E1",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.08,
    shadowRadius: 7,
    elevation: 1,
  },

  radio: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#AAB5CB",
    marginRight: 12,
  },

  radioActive: {
    borderWidth: 6,
    borderColor: "#4169E1",
  },

  typeText: {
    flex: 1,
    fontSize: 15,
    color: "#101B3A",
    fontWeight: "700",
  },

  label: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#52617B",
    marginTop: 11,
    marginBottom: 1,
  },

  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: "#D8E0EE",
    borderRadius: 14,
    paddingHorizontal: 15,
    fontSize: 15,
    color: "#101B3A",
    backgroundColor: "#FBFCFF",
  },

  multiline: {
    minHeight: 94,
    paddingTop: 14,
    textAlignVertical: "top",
  },

  button: {
    minHeight: 56,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4169E1",
    marginTop: 25,
    shadowColor: "#4169E1",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.9,
  },

  secondaryButton: {
    alignItems: "center",
    paddingVertical: 17,
  },

  secondaryText: {
    color: "#667085",
    fontSize: 13,
    fontWeight: "700",
  },
});
