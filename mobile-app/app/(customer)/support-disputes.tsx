import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

export default function CustomerSupportDisputes() {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <Text style={styles.title}>Support & Disputes</Text>

        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>How can we help?</Text>
          <Text style={styles.heroText}>
            Get help with your account, payments, shipments, or report an issue
            with a shipment.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Support"
          style={styles.option}
          onPress={() => router.push("/(customer)/support")}
        >
          <Text style={styles.icon}>🎧</Text>
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>Support</Text>
            <Text style={styles.optionDescription}>
              Create a support ticket or check your existing support requests.
            </Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Disputes"
          style={styles.option}
          onPress={() => router.push("/(customer)/disputes")}
        >
          <Text style={styles.icon}>⚠️</Text>
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>Shipment Disputes</Text>
            <Text style={styles.optionDescription}>
              Report or review an issue connected to one of your shipments.
            </Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F9FC",
  },
  header: {
    minHeight: 72,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E4E7EC",
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontSize: 34,
    lineHeight: 38,
    color: "#111827",
  },
  title: {
    fontSize: 19,
    fontWeight: "800",
    color: "#111827",
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    padding: 16,
    gap: 14,
  },
  hero: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: "#0B63CE",
    marginBottom: 2,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  heroText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#EAF2FF",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
  },
  icon: {
    fontSize: 28,
  },
  optionText: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  optionDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: "#667085",
  },
  arrow: {
    fontSize: 28,
    color: "#667085",
  },
});
