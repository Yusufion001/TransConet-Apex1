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
import { router } from "expo-router";
import { resetPassword } from "../../src/api/auth";

export default function ResetPasswordScreen() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const normalizedToken = token.trim();

    if (!/^\d{6}$/.test(normalizedToken)) {
      Alert.alert(
        "Invalid reset token",
        "Enter the 6-digit reset token sent to your email.",
      );
      return;
    }

    if (password.length < 8) {
      Alert.alert(
        "Password too short",
        "Your new password must contain at least 8 characters.",
      );
      return;
    }

    if (password !== confirmation) {
      Alert.alert(
        "Passwords do not match",
        "Enter the same password in both fields.",
      );
      return;
    }

    setLoading(true);

    try {
      await resetPassword(normalizedToken, password);

      Alert.alert(
        "Password updated",
        "Your password has been changed successfully. You can now sign in.",
        [{ text: "Sign In", onPress: () => router.replace("/(auth)/sign-in") }],
      );
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Unable to reset your password. The link may have expired.";

      Alert.alert("Password reset failed", message);
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
            <Text style={styles.title}>Create a new password.</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit token from your email, then create a new password.
            </Text>

            <View style={styles.form}>
              <Text style={styles.label}>RESET TOKEN</Text>
              <TextInput
                value={token}
                onChangeText={(value) =>
                  setToken(value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="Enter 6-digit token"
                placeholderTextColor="#999999"
                keyboardType="number-pad"
                maxLength={6}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
                editable={!loading}
              />

              <Text style={styles.label}>NEW PASSWORD</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter new password"
                placeholderTextColor="#999999"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
                editable={!loading}
              />

              <Text style={styles.label}>CONFIRM PASSWORD</Text>
              <TextInput
                value={confirmation}
                onChangeText={setConfirmation}
                placeholder="Confirm new password"
                placeholderTextColor="#999999"
                secureTextEntry
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
                  <Text style={styles.primaryText}>Update Password</Text>
                )}
              </Pressable>
            </View>
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
  },
  form: {
    marginTop: 32,
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
});
