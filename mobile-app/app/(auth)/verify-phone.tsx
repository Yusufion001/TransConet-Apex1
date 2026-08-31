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
import { router, useLocalSearchParams } from "expo-router";
import { sendPhoneVerificationOtp } from "../../src/api/auth";
import { useAuthStore } from "../../src/auth/auth.store";

export default function VerifyPhoneScreen() {
  const params = useLocalSearchParams<{
    token?: string;
    phone?: string;
  }>();

  const phoneVerificationToken =
    typeof params.token === "string" ? params.token : "";

  const phone =
    typeof params.phone === "string" ? params.phone : "";

  const verifyPhoneOtp = useAuthStore(
    (state) => state.verifyPhoneOtp,
  );

  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async () => {
    const normalizedPin = pin.trim();

    if (!phoneVerificationToken) {
      Alert.alert(
        "Verification unavailable",
        "This phone verification request is no longer available. Please return to sign up.",
      );
      return;
    }

    if (!/^\d{6}$/.test(normalizedPin)) {
      Alert.alert(
        "Invalid code",
        "Enter the 6-digit verification code sent to your phone.",
      );
      return;
    }

    setLoading(true);

    try {
      const session = await verifyPhoneOtp(
        phoneVerificationToken,
        normalizedPin,
      );

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
        "The verification code is invalid or has expired.";

      Alert.alert("Verification failed", message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!phoneVerificationToken) {
      Alert.alert(
        "Verification unavailable",
        "Return to sign up and start phone verification again.",
      );
      return;
    }

    setResending(true);

    try {
      const result = await sendPhoneVerificationOtp(
        phoneVerificationToken,
      );

      Alert.alert(
        "Code sent",
        result.message ||
          "A new verification code has been sent to your phone.",
      );
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Unable to resend the verification code. Please try again later.";

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
              Verify your phone.
            </Text>

            <Text style={styles.subtitle}>
              We sent a 6-digit verification code
              {phone ? ` to ${phone}` : " to your phone number"}.
              Enter it below to activate your account.
            </Text>

            <View style={styles.form}>
              <Text style={styles.label}>
                VERIFICATION CODE
              </Text>

              <TextInput
                value={pin}
                onChangeText={(value) =>
                  setPin(
                    value
                      .replace(/\D/g, "")
                      .slice(0, 6),
                  )
                }
                placeholder="6-digit code"
                placeholderTextColor="#999999"
                keyboardType="number-pad"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={6}
                style={styles.input}
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
                    Verify Phone
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
                    Resend Verification Code
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={() =>
                  router.replace({
                    pathname: "/(auth)/verify-email",
                    params: {
                      identifier: params.phone
                        ? ""
                        : undefined,
                    },
                  })
                }
                disabled={loading || resending}
                style={styles.emailButton}
              >
                <Text style={styles.emailText}>
                  Verify by Email Instead
                </Text>
              </Pressable>
            </View>
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
    marginBottom: 18,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    color: "#111111",
  },
  subtitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 24,
    color: "#666666",
  },
  form: {
    marginTop: 32,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#555555",
    marginBottom: 8,
  },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: "#D8D8D8",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 20,
    letterSpacing: 4,
    color: "#111111",
    backgroundColor: "#FFFFFF",
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 12,
    marginTop: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111111",
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 12,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D8D8D8",
  },
  secondaryText: {
    color: "#111111",
    fontSize: 15,
    fontWeight: "700",
  },
  emailButton: {
    alignItems: "center",
    marginTop: 20,
    paddingVertical: 10,
  },
  emailText: {
    color: "#555555",
    fontSize: 14,
    fontWeight: "700",
  },
});
