import { Link } from "expo-router";
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.brand}>TRANSCONET</Text>
          <Text style={styles.title}>Connected logistics.</Text>
          <Text style={styles.subtitle}>
            Transport intelligence built for movement.
          </Text>
        </View>

        <View style={styles.actions}>
          <Link href="/(auth)/sign-in" asChild>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryText}>Sign In</Text>
            </Pressable>
          </Link>

          <Link href="/(auth)/sign-up" asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Create Account</Text>
            </Pressable>
          </Link>
        </View>

        <Text style={styles.footer}>
          TRANSCONET · Connected logistics. Built for movement.
        </Text>
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
    paddingVertical: 32,
    justifyContent: "space-between",
  },
  hero: {
    paddingTop: 72,
  },
  brand: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 3,
    color: "#111111",
    marginBottom: 36,
  },
  title: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "800",
    color: "#111111",
    maxWidth: 340,
  },
  subtitle: {
    marginTop: 18,
    fontSize: 17,
    lineHeight: 25,
    color: "#666666",
    maxWidth: 330,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D6D6D6",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: "#111111",
    fontSize: 16,
    fontWeight: "700",
  },
  footer: {
    fontSize: 11,
    lineHeight: 17,
    color: "#888888",
    textAlign: "center",
  },
});
