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

        if (onboarding.marketplaceReady) {
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
            case "TIER_2_DOCUMENTS":
            case "TIER_2_REVIEW":
            case "APPROVED":
              router.replace("/(transporter-onboarding)/review");
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
    backgroundColor: "#FFFFFF",
  },
  keyboard: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  back: {
    fontSize: 16,
    color: "#555555",
    fontWeight: "600",
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  brand: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 3,
    color: "#111111",
    marginBottom: 22,
  },
  title: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "800",
    color: "#111111",
  },
  subtitle: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    color: "#666666",
    maxWidth: 340,
  },
  form: {
    marginTop: 34,
  },
  label: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#555555",
  },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: "#D8D8D8",
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#111111",
    backgroundColor: "#FAFAFA",
  },
  forgot: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: "700",
    color: "#111111",
  },
  primaryButton: {
    minHeight: 56,
    marginTop: 24,
    borderRadius: 12,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.65,
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  bottom: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
  },
  bottomText: {
    color: "#777777",
    fontSize: 14,
  },
  createText: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "800",
  },
});
