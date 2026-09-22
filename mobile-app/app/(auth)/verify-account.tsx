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
    backgroundColor: "#F4F7FF",
  },

  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 22,
  },

  brand: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#E7EDFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2.2,
    color: "#4169E1",
    overflow: "hidden",
  },

  content: {
    flex: 1,
    justifyContent: "center",
  },

  title: {
    fontSize: 32,
    lineHeight: 39,
    fontWeight: "900",
    color: "#101B3A",
    letterSpacing: -0.6,
  },

  subtitle: {
    marginTop: 12,
    maxWidth: 390,
    fontSize: 15,
    lineHeight: 23,
    color: "#667085",
  },

  options: {
    marginTop: 28,
    gap: 14,
  },

  option: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7F5",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 19,
    shadowColor: "#101B3A",
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },

  optionTitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "800",
    color: "#101B3A",
  },

  optionText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
  },

  note: {
    marginTop: 22,
    paddingHorizontal: 8,
    fontSize: 13,
    lineHeight: 20,
    color: "#7A8499",
    textAlign: "center",
  },
});
