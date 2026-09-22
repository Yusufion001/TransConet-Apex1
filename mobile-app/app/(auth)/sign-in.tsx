import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link, router } from "expo-router";
import { useAuthStore } from "../../src/auth/auth.store";
import { getTransporterOnboardingStatus } from "../../src/api/transporter";

export default function SignInScreen() {
  const signIn = useAuthStore((state) => state.signIn);
  const loading = useAuthStore((state) => state.loading);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const handleSignIn = async () => {
    const normalizedIdentifier = identifier.trim();

    if (!normalizedIdentifier || !password) {
      Alert.alert(
        "Sign in required",
        "Enter your email or phone number and password.",
      );
      return;
    }

    try {
      const session = await signIn({
        identifier: normalizedIdentifier,
        password,
      });

      if (session.user.role === "CUSTOMER") {
        router.replace("/(customer)");
      } else if (session.user.role === "TRANSPORTER") {
        const onboarding = await getTransporterOnboardingStatus(
          session.user.id,
        );

        if (onboarding.marketplaceReady || onboarding.currentStep === "APPROVED") {
          router.replace("/(transporter)");
        } else {
          switch (onboarding.currentStep) {
            case "PROFILE_SETUP":
              router.replace("/(transporter-onboarding)/profile");
              break;
            case "DOCUMENTS":
            case "IDENTITY_VERIFICATION":
              router.replace("/(transporter-onboarding)/documents");
              break;
            case "VEHICLE":
              router.replace("/(transporter-onboarding)/vehicle");
              break;
            case "ADMIN_REVIEW":
              router.replace("/(transporter-onboarding)/review");
              break;
            case "TIER_2_DOCUMENTS":
              router.replace("/(transporter-onboarding)/tier2-documents");
              break;
            case "TIER_2_REVIEW":
              router.replace("/(transporter-onboarding)/tier2-review");
              break;
            case "EMAIL_VERIFICATION":
              router.replace("/(auth)/verify-email");
              break;
            default:
              router.replace("/(transporter-onboarding)/profile");
          }
        }
      } else {
        Alert.alert(
          "Account unavailable",
          "This mobile application does not support administrator accounts.",
        );
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Unable to sign in. Please check your credentials and try again.";

      Alert.alert("Sign in failed", message);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>

          <View style={styles.content}>
            <Text style={styles.brand}>TRANSCONET</Text>
            <Text style={styles.title}>Welcome back.</Text>
            <Text style={styles.subtitle}>
              Sign in to manage your connected logistics operations.
            </Text>

            <View style={styles.form}>
              <Text style={styles.label}>EMAIL OR PHONE</Text>
              <TextInput
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="Enter email or phone"
                placeholderTextColor="#999999"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={styles.input}
                editable={!loading}
              />

              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                placeholderTextColor="#999999"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
                editable={!loading}
              />

              <Link href="/(auth)/forgot-password" asChild>
                <Pressable disabled={loading}>
                  <Text style={styles.forgot}>Forgot password?</Text>
                </Pressable>
              </Link>

              <Pressable
                onPress={() => void handleSignIn()}
                disabled={loading}
                style={[
                  styles.primaryButton,
                  loading && styles.disabledButton,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryText}>Sign In</Text>
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.bottom}>
            <Text style={styles.bottomText}>New to TransConet?</Text>
            <Link href="/(auth)/sign-up" asChild>
              <Pressable>
                <Text style={styles.createText}> Create an account</Text>
              </Pressable>
            </Link>
          </View>
        </View>
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
    flex: 1,
    paddingHorizontal: 22,
    paddingVertical: 20,
  },
  back: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#E8EEFF",
    color: "#4169E1",
    fontSize: 14,
    fontWeight: "800",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    maxWidth: 560,
    width: "100%",
    alignSelf: "center",
  },
  brand: {
    alignSelf: "flex-start",
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#E8EEFF",
    color: "#4169E1",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 18,
  },
  title: {
    fontSize: 36,
    lineHeight: 43,
    fontWeight: "900",
    color: "#101B3A",
    letterSpacing: -0.7,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 23,
    color: "#667085",
    maxWidth: 390,
  },
  form: {
    marginTop: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E0E6F2",
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 3,
  },
  label: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#475467",
  },
  input: {
    minHeight: 55,
    borderWidth: 1,
    borderColor: "#D9E0EC",
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#101B3A",
    backgroundColor: "#F9FAFC",
  },
  forgot: {
    alignSelf: "flex-end",
    marginTop: 13,
    fontSize: 13,
    fontWeight: "800",
    color: "#4169E1",
  },
  primaryButton: {
    minHeight: 55,
    marginTop: 23,
    borderRadius: 15,
    backgroundColor: "#4169E1",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.65,
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  bottom: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
  },
  bottomText: {
    color: "#667085",
    fontSize: 14,
  },
  createText: {
    color: "#4169E1",
    fontSize: 14,
    fontWeight: "900",
  },
});
