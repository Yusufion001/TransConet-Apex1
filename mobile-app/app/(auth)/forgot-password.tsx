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
import { forgotPassword } from "../../src/api/auth";

export default function ForgotPasswordScreen() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const value = identifier.trim();

    if (!value) {
      Alert.alert(
        "Contact required",
        "Enter the email address or phone number associated with your account.",
      );
      return;
    }

    setLoading(true);

    try {
      await forgotPassword(value);

      Alert.alert(
        "Reset token sent",
        "A 6-digit reset token has been sent to your email. The token expires in 1 minute.",
        [{ text: "Continue", onPress: () => router.replace("/(auth)/reset-password") }],
      );
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Unable to process the password-reset request. Please try again.";

      Alert.alert("Password reset", message);
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
        <View style={styles.container}>
          <Pressable onPress={() => router.back()} disabled={loading}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>

          <View style={styles.content}>
            <Text style={styles.brand}>TRANSCONET</Text>
            <Text style={styles.title}>Forgot your password?</Text>
            <Text style={styles.subtitle}>
              Enter the email address or phone number connected to your
              TransConet account.
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
                style={styles.input}
                editable={!loading}
              />

              <Pressable
                onPress={() => void handleSubmit()}
                disabled={loading}
                style={[
                  styles.primaryButton,
                  loading && styles.disabledButton,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryText}>
                    Send Reset Instructions
                  </Text>
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.bottom}>
            <Text style={styles.bottomText}>Remember your password?</Text>
            <Link href="/(auth)/sign-in" asChild>
              <Pressable disabled={loading}>
                <Text style={styles.linkText}> Sign in</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  keyboard: { flex: 1 },
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
    maxWidth: 350,
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
  primaryButton: {
    minHeight: 56,
    marginTop: 24,
    borderRadius: 12,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: { opacity: 0.65 },
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
  linkText: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "800",
  },
});
