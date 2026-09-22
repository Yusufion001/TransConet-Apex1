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
    backgroundColor: "#F4F7FF",
  },

  keyboard: {
    flex: 1,
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 32,
  },

  eyebrow: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#E7EDFF",
    color: "#4169E1",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
  },

  title: {
    marginTop: 17,
    color: "#101B3A",
    fontSize: 31,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: -0.7,
  },

  subtitle: {
    marginTop: 9,
    maxWidth: 370,
    color: "#667085",
    fontSize: 15,
    lineHeight: 22,
  },

  form: {
    marginTop: 22,
    paddingHorizontal: 17,
    paddingTop: 6,
    paddingBottom: 18,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7F4",

    shadowColor: "#173B8F",
    shadowOpacity: 0.10,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 5,
  },

  label: {
    marginTop: 16,
    marginBottom: 7,
    color: "#344054",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: 1.05,
  },

  input: {
    minHeight: 55,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#D8E0EF",
    borderRadius: 13,
    backgroundColor: "#FBFCFF",
    color: "#172033",
    fontSize: 16,

    shadowColor: "#102B68",
    shadowOpacity: 0.025,
    shadowRadius: 4,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 1,
  },

  multilineInput: {
    minHeight: 94,
    paddingTop: 15,
    textAlignVertical: "top",
  },

  roleRow: {
    gap: 11,
  },

  roleButton: {
    minHeight: 79,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: "center",

    borderWidth: 1,
    borderColor: "#D8E0EF",
    borderRadius: 15,
    backgroundColor: "#FBFCFF",
  },

  roleButtonSelected: {
    borderColor: "#4169E1",
    backgroundColor: "#4169E1",

    shadowColor: "#4169E1",
    shadowOpacity: 0.22,
    shadowRadius: 11,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 4,
  },

  roleTitle: {
    color: "#172033",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
  },

  roleTitleSelected: {
    color: "#FFFFFF",
  },

  roleText: {
    marginTop: 4,
    color: "#667085",
    fontSize: 13,
    lineHeight: 19,
  },

  roleTextSelected: {
    color: "#E9EEFF",
  },

  sectionTitle: {
    marginTop: 28,
    marginBottom: 2,
    color: "#101B3A",
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "900",
    letterSpacing: -0.2,
  },

  choiceRow: {
    flexDirection: "row",
    gap: 10,
  },

  choiceButton: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 10,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,
    borderColor: "#D8E0EF",
    borderRadius: 13,
    backgroundColor: "#FBFCFF",
  },

  choiceButtonSelected: {
    borderColor: "#4169E1",
    backgroundColor: "#4169E1",

    shadowColor: "#4169E1",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 2,
  },

  choiceText: {
    color: "#344054",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },

  choiceTextSelected: {
    color: "#FFFFFF",
  },

  identityNote: {
    marginTop: 13,
    paddingHorizontal: 13,
    paddingVertical: 12,

    borderRadius: 11,
    backgroundColor: "#F3F6FF",

    color: "#667085",
    fontSize: 12,
    lineHeight: 18,
  },

  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    marginTop: 19,
  },

  checkbox: {
    width: 23,
    height: 23,
    marginTop: 1,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1.5,
    borderColor: "#B8C2D6",
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
  },

  checkboxSelected: {
    borderColor: "#4169E1",
    backgroundColor: "#4169E1",

    shadowColor: "#4169E1",
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 2,
  },

  checkmark: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "900",
  },

  consentText: {
    flex: 1,
    color: "#475467",
    fontSize: 13,
    lineHeight: 19,
  },

  primaryButton: {
    minHeight: 57,
    marginTop: 24,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 14,
    backgroundColor: "#4169E1",

    shadowColor: "#4169E1",
    shadowOpacity: 0.28,
    shadowRadius: 13,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 5,
  },

  disabledButton: {
    opacity: 0.65,
  },

  primaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
    letterSpacing: 0.1,
  },

  bottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    paddingTop: 25,
    paddingBottom: 8,
  },

  bottomText: {
    color: "#667085",
    fontSize: 14,
  },

  signInText: {
    color: "#4169E1",
    fontSize: 14,
    fontWeight: "900",
  },
});
