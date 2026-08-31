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
import { Link, router } from "expo-router";
import { useAuthStore } from "../../src/auth/auth.store";
import type { UserRole } from "../../src/auth/auth.types";

type MobileRole = Exclude<UserRole, "ADMIN">;

export default function SignUpScreen() {
  const signUp = useAuthStore((state) => state.signUp);
  const loading = useAuthStore((state) => state.loading);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<MobileRole>("CUSTOMER");

  const handleSignUp = async () => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedFirstName || !trimmedLastName) {
      Alert.alert(
        "Details required",
        "Enter your first and last name.",
      );
      return;
    }

    if (!trimmedEmail || !password) {
      Alert.alert(
        "Account details required",
        "Enter your email address and password.",
      );
      return;
    }

    try {
      const result = await signUp({
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        email: trimmedEmail,
        ...(trimmedPhone ? { phone: trimmedPhone } : {}),
        password,
        role,
      });

      /*
       * Email is required during registration, but either
       * email verification OR phone verification can activate
       * the account.
       */
      if (
        result.requiresPhoneVerification &&
        result.phoneVerificationToken &&
        trimmedPhone
      ) {
        router.replace({
          pathname: "/(auth)/verify-account",
          params: {
            email: trimmedEmail,
            phone: trimmedPhone,
            phoneVerificationToken:
              result.phoneVerificationToken,
          },
        });
        return;
      }

      if (result.requiresEmailVerification) {
        router.replace({
          pathname: "/(auth)/verify-email",
          params: {
            identifier: trimmedEmail,
          },
        });
        return;
      }

      Alert.alert(
        "Account created",
        "Your account has been created. You can now sign in.",
        [
          {
            text: "Sign In",
            onPress: () =>
              router.replace("/(auth)/sign-in"),
          },
        ],
      );
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Unable to create your account. Please check your details and try again.";

      Alert.alert("Registration failed", message);
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
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>

          <View style={styles.content}>
            <Text style={styles.brand}>TRANSCONET</Text>
            <Text style={styles.title}>Create your account.</Text>
            <Text style={styles.subtitle}>
              Join the connected transport network.
            </Text>

            <View style={styles.form}>
              <Text style={styles.label}>FIRST NAME</Text>
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor="#999999"
                autoCapitalize="words"
                style={styles.input}
                editable={!loading}
              />

              <Text style={styles.label}>LAST NAME</Text>
              <TextInput
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor="#999999"
                autoCapitalize="words"
                style={styles.input}
                editable={!loading}
              />

              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email address"
                placeholderTextColor="#999999"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
                editable={!loading}
              />

              <Text style={styles.label}>PHONE NUMBER (OPTIONAL)</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="Phone number"
                placeholderTextColor="#999999"
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
                editable={!loading}
              />

              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Create a password"
                placeholderTextColor="#999999"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
                editable={!loading}
              />

              <Text style={styles.label}>ACCOUNT TYPE</Text>

              <View style={styles.roleRow}>
                <Pressable
                  onPress={() => setRole("CUSTOMER")}
                  disabled={loading}
                  style={[
                    styles.roleButton,
                    role === "CUSTOMER" && styles.roleButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.roleTitle,
                      role === "CUSTOMER" && styles.roleTitleSelected,
                    ]}
                  >
                    Customer
                  </Text>
                  <Text
                    style={[
                      styles.roleText,
                      role === "CUSTOMER" && styles.roleTextSelected,
                    ]}
                  >
                    Book and manage transport
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setRole("TRANSPORTER")}
                  disabled={loading}
                  style={[
                    styles.roleButton,
                    role === "TRANSPORTER" && styles.roleButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.roleTitle,
                      role === "TRANSPORTER" && styles.roleTitleSelected,
                    ]}
                  >
                    Transporter
                  </Text>
                  <Text
                    style={[
                      styles.roleText,
                      role === "TRANSPORTER" && styles.roleTextSelected,
                    ]}
                  >
                    Provide transport capacity
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => void handleSignUp()}
                disabled={loading}
                style={[
                  styles.primaryButton,
                  loading && styles.disabledButton,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryText}>Create Account</Text>
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.bottom}>
            <Text style={styles.bottomText}>Already have an account?</Text>
            <Link href="/(auth)/sign-in" asChild>
              <Pressable>
                <Text style={styles.signInText}> Sign in</Text>
              </Pressable>
            </Link>
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
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  back: {
    fontSize: 16,
    color: "#555555",
    fontWeight: "600",
  },
  content: {
    paddingTop: 34,
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
    marginTop: 22,
  },
  label: {
    marginTop: 14,
    marginBottom: 7,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#555555",
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#D8D8D8",
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#111111",
    backgroundColor: "#FAFAFA",
  },
  roleRow: {
    gap: 10,
  },
  roleButton: {
    borderWidth: 1,
    borderColor: "#D8D8D8",
    borderRadius: 10,
    padding: 15,
    backgroundColor: "#FAFAFA",
  },
  roleButtonSelected: {
    borderColor: "#111111",
    backgroundColor: "#111111",
  },
  roleTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111111",
  },
  roleTitleSelected: {
    color: "#FFFFFF",
  },
  roleText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: "#777777",
  },
  roleTextSelected: {
    color: "#D0D0D0",
  },
  primaryButton: {
    minHeight: 56,
    marginTop: 22,
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
    paddingTop: 28,
    paddingBottom: 12,
  },
  bottomText: {
    color: "#777777",
    fontSize: 14,
  },
  signInText: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "800",
  },
});
