import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
          <Ionicons name="arrow-back" size={20} color="#4169E1" />
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerEyebrow}>CUSTOMER CARE</Text>
          <Text style={styles.title}>Support & Disputes</Text>
        </View>

      </View>

      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="headset" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>WE'RE HERE TO HELP</Text>
            <Text style={styles.heroTitle}>How can we help?</Text>
            <Text style={styles.heroText}>
              Get help with your account, payments, shipments, or report an issue
              with a shipment.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>HELP CENTER</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Support"
          style={styles.option}
          onPress={() => router.push("/(customer)/support")}
        >
          <View style={styles.optionIcon}>
            <Ionicons name="headset-outline" size={24} color="#4169E1" />
          </View>
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>Support</Text>
            <Text style={styles.optionDescription}>
              Create a support ticket or check your existing support requests.
            </Text>
          </View>
          <View style={styles.arrow}>
            <Ionicons name="chevron-forward" size={20} color="#4169E1" />
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Disputes"
          style={styles.option}
          onPress={() => router.push("/(customer)/disputes")}
        >
          <View style={styles.optionIcon}>
            <Ionicons name="warning-outline" size={24} color="#4169E1" />
          </View>
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>Shipment Disputes</Text>
            <Text style={styles.optionDescription}>
              Report or review an issue connected to one of your shipments.
            </Text>
          </View>
          <View style={styles.arrow}>
            <Ionicons name="chevron-forward" size={20} color="#4169E1" />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F4F7FF",
  },
  header: {
    minHeight: 88,
    paddingHorizontal: 20,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E6ECF5",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#D8E4FF",
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 14,
    alignItems: "center",
    paddingRight: 44,
  },
  headerEyebrow: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: "#4169E1",
  },
  title: {
    marginTop: 3,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "800",
    color: "#101B3A",
  },
  content: {
    padding: 20,
    gap: 14,
  },
  hero: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 20,
    borderRadius: 22,
    backgroundColor: "#4169E1",
    shadowColor: "#101B3A",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  heroCopy: {
    flex: 1,
    marginLeft: 14,
  },
  heroEyebrow: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#DCE8FF",
  },
  heroTitle: {
    marginTop: 3,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  heroText: {
    marginTop: 7,
    fontSize: 14,
    lineHeight: 20,
    color: "#EAF1FF",
  },
  sectionLabel: {
    marginTop: 4,
    marginBottom: 0,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: "#667085",
  },
  option: {
    minHeight: 104,
    flexDirection: "row",
    alignItems: "center",
    padding: 17,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE5F5",
    shadowColor: "#101B3A",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#D8E4FF",
  },
  optionText: {
    flex: 1,
    marginLeft: 14,
  },
  optionTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    color: "#101B3A",
  },
  optionDescription: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    color: "#667085",
  },
  arrow: {
    width: 36,
    height: 36,
    marginLeft: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F7FF",
  },
});
