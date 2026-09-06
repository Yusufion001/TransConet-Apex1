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
type CustomerType = "INDIVIDUAL" | "BUSINESS";
type GovernmentIdType = "NIN" | "DRIVERS_LICENSE";

export default function SignUpScreen() {
  const { signUp, loading } = useAuthStore();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<MobileRole>("CUSTOMER");

  const [customerType, setCustomerType] =
    useState<CustomerType>("INDIVIDUAL");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [governmentIdType, setGovernmentIdType] =
    useState<GovernmentIdType>("NIN");
  const [governmentIdNumber, setGovernmentIdNumber] = useState("");
  const [subjectConsent, setSubjectConsent] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessRegistrationNumber, setBusinessRegistrationNumber] =
    useState("");

  const handleSignUp = async () => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    const trimmedDateOfBirth = dateOfBirth.trim();
    const trimmedGovernmentIdNumber = governmentIdNumber.trim();
    const trimmedBusinessName = businessName.trim();
    const trimmedBusinessAddress = businessAddress.trim();
    const trimmedBusinessRegistrationNumber =
      businessRegistrationNumber.trim();

    if (
      trimmedFirstName.length < 2 ||
      trimmedLastName.length < 2 ||
      !trimmedEmail ||
      password.length < 8
    ) {
      Alert.alert(
        "Incomplete registration",
        "Please provide your first name, last name, email address and a password of at least 8 characters.",
      );
      return;
    }

    if (role === "CUSTOMER") {
      if (!trimmedDateOfBirth) {
        Alert.alert(
          "Date of birth required",
          "Enter your date of birth to continue.",
        );
        return;
      }

      if (!trimmedGovernmentIdNumber) {
        Alert.alert(
          "Government ID required",
          "Enter your NIN or Driver’s Licence number to continue.",
        );
        return;
      }

      if (!subjectConsent) {
        Alert.alert(
          "Verification consent required",
          "You must consent to government ID verification before creating a customer account.",
        );
        return;
      }

      if (
        customerType === "BUSINESS" &&
        (!trimmedBusinessName || !trimmedBusinessAddress)
      ) {
        Alert.alert(
          "Business information required",
          "Enter the business name and business address to continue.",
        );
        return;
      }
    }

    try {
      const result = await signUp({
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        email: trimmedEmail,
        ...(trimmedPhone ? { phone: trimmedPhone } : {}),
        password,
        role,

        ...(role === "CUSTOMER"
          ? {
              customerType,
              dateOfBirth: trimmedDateOfBirth,
              governmentIdType,
              governmentIdNumber: trimmedGovernmentIdNumber,
              subjectConsent: true,
              ...(customerType === "BUSINESS"
                ? {
                    businessName: trimmedBusinessName,
                    businessAddress: trimmedBusinessAddress,
                    ...(trimmedBusinessRegistrationNumber
                      ? {
                          businessRegistrationNumber:
                            trimmedBusinessRegistrationNumber,
                        }
                      : {}),
                  }
                : {}),
            }
          : {}),
      });

      if (result.requiresPhoneVerification && result.phoneVerificationToken) {
        router.replace({
          pathname: "/(auth)/verify-account",
          params: {
            phoneVerificationToken: result.phoneVerificationToken,
          },
        });
        return;
      }

      if (result.requiresEmailVerification) {
        router.replace("/(auth)/verify-email");
        return;
      }

      Alert.alert(
        "Account created",
        "Your account has been created. Please sign in to continue.",
        [
          {
            text: "Sign in",
            onPress: () => router.replace("/(auth)/sign-in"),
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        "Registration failed",
        error instanceof Error
          ? error.message
          : "Unable to create your account. Please try again.",
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.eyebrow}>TRANSCONET</Text>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            Register with accurate information so your account can be
            verified securely.
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>FIRST NAME</Text>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Enter first name"
              placeholderTextColor="#999999"
              style={styles.input}
              autoCapitalize="words"
            />

            <Text style={styles.label}>LAST NAME</Text>
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="Enter last name"
              placeholderTextColor="#999999"
              style={styles.input}
              autoCapitalize="words"
            />

            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Enter email address"
              placeholderTextColor="#999999"
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>PHONE NUMBER (OPTIONAL)</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter phone number"
              placeholderTextColor="#999999"
              style={styles.input}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Minimum 8 characters"
              placeholderTextColor="#999999"
              style={styles.input}
              secureTextEntry
            />

            <Text style={styles.label}>ACCOUNT TYPE</Text>
            <View style={styles.roleRow}>
              <Pressable
                style={[
                  styles.roleButton,
                  role === "CUSTOMER" && styles.roleButtonSelected,
                ]}
                onPress={() => setRole("CUSTOMER")}
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
                style={[
                  styles.roleButton,
                  role === "TRANSPORTER" && styles.roleButtonSelected,
                ]}
                onPress={() => setRole("TRANSPORTER")}
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

            {role === "CUSTOMER" && (
              <>
                <Text style={styles.sectionTitle}>Customer verification</Text>

                <Text style={styles.label}>CUSTOMER TYPE</Text>
                <View style={styles.choiceRow}>
                  <Pressable
                    style={[
                      styles.choiceButton,
                      customerType === "INDIVIDUAL" &&
                        styles.choiceButtonSelected,
                    ]}
                    onPress={() => setCustomerType("INDIVIDUAL")}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        customerType === "INDIVIDUAL" &&
                          styles.choiceTextSelected,
                      ]}
                    >
                      Individual
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.choiceButton,
                      customerType === "BUSINESS" &&
                        styles.choiceButtonSelected,
                    ]}
                    onPress={() => setCustomerType("BUSINESS")}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        customerType === "BUSINESS" &&
                          styles.choiceTextSelected,
                      ]}
                    >
                      Business
                    </Text>
                  </Pressable>
                </View>

                {customerType === "BUSINESS" && (
                  <>
                    <Text style={styles.label}>BUSINESS NAME</Text>
                    <TextInput
                      value={businessName}
                      onChangeText={setBusinessName}
                      placeholder="Registered business name"
                      placeholderTextColor="#999999"
                      style={styles.input}
                      autoCapitalize="words"
                    />

                    <Text style={styles.label}>BUSINESS ADDRESS</Text>
                    <TextInput
                      value={businessAddress}
                      onChangeText={setBusinessAddress}
                      placeholder="Business address"
                      placeholderTextColor="#999999"
                      style={[styles.input, styles.multilineInput]}
                      multiline
                    />

                    <Text style={styles.label}>
                      CAC / REGISTRATION NUMBER (OPTIONAL)
                    </Text>
                    <TextInput
                      value={businessRegistrationNumber}
                      onChangeText={setBusinessRegistrationNumber}
                      placeholder="Enter CAC or registration number"
                      placeholderTextColor="#999999"
                      style={styles.input}
                      autoCapitalize="characters"
                    />

                    <Text style={styles.identityNote}>
                      The responsible person’s first name, last name and date
                      of birth above will be used for identity verification.
                    </Text>
                  </>
                )}

                <Text style={styles.label}>DATE OF BIRTH</Text>
                <TextInput
                  value={dateOfBirth}
                  onChangeText={setDateOfBirth}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#999999"
                  style={styles.input}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                />

                <Text style={styles.label}>GOVERNMENT ID TYPE</Text>
                <View style={styles.choiceRow}>
                  <Pressable
                    style={[
                      styles.choiceButton,
                      governmentIdType === "NIN" &&
                        styles.choiceButtonSelected,
                    ]}
                    onPress={() => setGovernmentIdType("NIN")}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        governmentIdType === "NIN" &&
                          styles.choiceTextSelected,
                      ]}
                    >
                      NIN
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.choiceButton,
                      governmentIdType === "DRIVERS_LICENSE" &&
                        styles.choiceButtonSelected,
                    ]}
                    onPress={() =>
                      setGovernmentIdType("DRIVERS_LICENSE")
                    }
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        governmentIdType === "DRIVERS_LICENSE" &&
                          styles.choiceTextSelected,
                      ]}
                    >
                      Driver’s Licence
                    </Text>
                  </Pressable>
                </View>

                <Text style={styles.label}>GOVERNMENT ID NUMBER</Text>
                <TextInput
                  value={governmentIdNumber}
                  onChangeText={setGovernmentIdNumber}
                  placeholder={
                    governmentIdType === "NIN"
                      ? "Enter NIN"
                      : "Enter Driver’s Licence number"
                  }
                  placeholderTextColor="#999999"
                  style={styles.input}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />

                <Pressable
                  style={styles.consentRow}
                  onPress={() => setSubjectConsent((value) => !value)}
                >
                  <View
                    style={[
                      styles.checkbox,
                      subjectConsent && styles.checkboxSelected,
                    ]}
                  >
                    {subjectConsent && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>

                  <Text style={styles.consentText}>
                    I consent to TransConet verifying the government ID
                    information I provide for identity verification.
                  </Text>
                </Pressable>
              </>
            )}

            <Pressable
              style={[
                styles.primaryButton,
                loading && styles.disabledButton,
              ]}
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryText}>Create Account</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.bottom}>
            <Text style={styles.bottomText}>Already have an account? </Text>
            <Link href="/(auth)/sign-in" asChild>
              <Pressable>
                <Text style={styles.signInText}>Sign in</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  keyboard: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 24,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    color: "#777777",
  },
  title: {
    marginTop: 8,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
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
  multilineInput: {
    minHeight: 90,
    paddingTop: 14,
    textAlignVertical: "top",
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
  sectionTitle: {
    marginTop: 26,
    fontSize: 18,
    fontWeight: "900",
    color: "#111111",
  },
  choiceRow: {
    flexDirection: "row",
    gap: 10,
  },
  choiceButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#D8D8D8",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: "#FAFAFA",
  },
  choiceButtonSelected: {
    borderColor: "#111111",
    backgroundColor: "#111111",
  },
  choiceText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333333",
    textAlign: "center",
  },
  choiceTextSelected: {
    color: "#FFFFFF",
  },
  identityNote: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
    color: "#777777",
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 18,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: "#AAAAAA",
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  checkboxSelected: {
    borderColor: "#111111",
    backgroundColor: "#111111",
  },
  checkmark: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: "#555555",
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
