import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

export default function VerifyAccountScreen() {
  const params = useLocalSearchParams<{
    email?: string;
    phone?: string;
    phoneVerificationToken?: string;
  }>();

  const email =
    typeof params.email === "string" ? params.email : "";

  const phone =
    typeof params.phone === "string" ? params.phone : "";

  const phoneVerificationToken =
    typeof params.phoneVerificationToken === "string"
      ? params.phoneVerificationToken
      : "";

  const handleEmailVerification = () => {
    router.replace({
      pathname: "/(auth)/verify-email",
      params: {
        identifier: email,
      },
    });
  };

  const handlePhoneVerification = () => {
    router.replace({
      pathname: "/(auth)/verify-phone",
      params: {
        token: phoneVerificationToken,
        phone,
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.brand}>TRANSCONET</Text>

        <View style={styles.content}>
          <Text style={styles.title}>
            Verify your account.
          </Text>

          <Text style={styles.subtitle}>
            Choose one verification method. You only
            need to complete one to activate your account.
          </Text>

          <View style={styles.options}>
            <Pressable
              onPress={handleEmailVerification}
              style={styles.option}
            >
              <Text style={styles.optionTitle}>
                Verify with Email
              </Text>

              <Text style={styles.optionText}>
                We will send a verification link to{" "}
                {email || "your email address"}.
              </Text>
            </Pressable>

            {phoneVerificationToken && (
              <Pressable
                onPress={handlePhoneVerification}
                style={styles.option}
              >
                <Text style={styles.optionTitle}>
                  Verify with SMS
                </Text>

                <Text style={styles.optionText}>
                  Enter the 6-digit code sent to{" "}
                  {phone || "your phone number"}.
                </Text>
              </Pressable>
            )}
          </View>

          <Text style={styles.note}>
            You do not need to verify both your email
            and phone number to activate your account.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  brand: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 3,
    color: "#111111",
    marginBottom: 18,
  },
  content: {
    flex: 1,
    justifyContent: "center",
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
  options: {
    marginTop: 32,
    gap: 14,
  },
  option: {
    borderWidth: 1,
    borderColor: "#D8D8D8",
    borderRadius: 14,
    padding: 20,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111111",
  },
  optionText: {
    marginTop: 7,
    fontSize: 14,
    lineHeight: 21,
    color: "#666666",
  },
  note: {
    marginTop: 24,
    fontSize: 13,
    lineHeight: 20,
    color: "#777777",
    textAlign: "center",
  },
});
