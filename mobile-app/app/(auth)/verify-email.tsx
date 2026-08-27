import { useEffect, useRef, useState } from "react";
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
import { Link, router, useLocalSearchParams } from "expo-router";
import {
  resendEmailVerification,
} from "../../src/api/auth";
import { useAuthStore } from "../../src/auth/auth.store";

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{
    identifier?: string;
    token?: string;
  }>();
  const identifier =
    typeof params.identifier === "string"
      ? params.identifier
      : "";

  const verifyEmail = useAuthStore(
    (state) => state.verifyEmail,
  );

  const [token, setToken] = useState(
    typeof params.token === "string" ? params.token : "",
  );
  const autoVerifyStarted = useRef(false);

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const incomingToken =
      typeof params.token === "string"
        ? params.token.trim()
        : "";

    if (!incomingToken || autoVerifyStarted.current) {
      return;
    }

    autoVerifyStarted.current = true;
    setToken(incomingToken);
    void handleVerify(incomingToken);
  }, [params.token]);

  const handleVerify = async (providedToken?: string) => {
    const normalizedToken =
      (providedToken ?? token).trim();

    if (!normalizedToken) {
      Alert.alert(
        "Verification code required",
        "Open the verification link from your email or enter the verification token.",
      );
      return;
    }

    setLoading(true);

    try {
      const session = await verifyEmail(normalizedToken);

      if (session.user.role === "CUSTOMER") {
        router.replace("/(customer)");
        return;
      }

      if (session.user.role === "TRANSPORTER") {
        router.replace("/(transporter)");
        return;
      }

      Alert.alert(
        "Account unavailable",
        "This mobile application does not support administrator accounts.",
      );
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "The verification token is invalid or has expired.";

      Alert.alert("Verification failed", message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!identifier) {
      Alert.alert(
        "Contact unavailable",
        "Return to sign up and enter your email address again.",
      );
      return;
    }

    setResending(true);

    try {
      await resendEmailVerification(identifier);

      Alert.alert(
        "Verification email sent",
        "If your account is eligible, a new verification email has been sent.",
      );
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Unable to resend the verification email. Please try again later.";

      Alert.alert("Resend failed", message);
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <View style={styles.container}>
          <Pressable
            onPress={() => router.back()}
            disabled={loading || resending}
          >
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>

          <View style={styles.content}>
            <Text style={styles.brand}>TRANSCONET</Text>

            <Text style={styles.title}>
              Verify your email.
            </Text>

            <Text style={styles.subtitle}>
              We sent a verification link to your email
              address. Open the link to get your verification
              token, then enter it below.
            </Text>

            <View style={styles.form}>
              <Text style={styles.label}>
                VERIFICATION TOKEN
              </Text>

              <TextInput
                value={token}
                onChangeText={setToken}
                placeholder="Paste verification token"
                placeholderTextColor="#999999"
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                style={[
                  styles.input,
                  styles.tokenInput,
                ]}
                editable={!loading && !resending}
              />

              <Pressable
                onPress={() => void handleVerify()}
                disabled={loading || resending}
                style={[
                  styles.primaryButton,
                  (loading || resending) &&
                    styles.disabledButton,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryText}>
                    Verify Email
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => void handleResend()}
                disabled={loading || resending}
                style={styles.secondaryButton}
              >
                {resending ? (
                  <ActivityIndicator />
                ) : (
                  <Text style={styles.secondaryText}>
                    Resend Verification Email
                  </Text>
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.bottom}>
            <Text style={styles.bottomText}>
              Already verified?
            </Text>

            <Link
              href="/(auth)/sign-in"
              asChild
            >
              <Pressable
                disabled={loading || resending}
              >
                <Text style={styles.linkText}>
                  {" "}Sign in
                </Text>
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
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    color: "#111111",
  },
  subtitle: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    color: "#666666",
    maxWidth: 360,
  },
  form: {
    marginTop: 32,
  },
  label: {
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
  tokenInput: {
    minHeight: 100,
    paddingTop: 16,
    textAlignVertical: "top",
  },
  primaryButton: {
    minHeight: 56,
    marginTop: 24,
    borderRadius: 12,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    minHeight: 52,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D8D8D8",
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
  secondaryText: {
    color: "#111111",
    fontSize: 15,
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
  linkText: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "800",
  },
});
