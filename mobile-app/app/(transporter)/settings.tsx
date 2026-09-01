import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function TransporterSettings() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>

      <Text style={styles.eyebrow}>TRANSCONET</Text>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>
        Manage your transporter application preferences.
      </Text>

      <View style={styles.card}>
        <Text style={styles.section}>APPLICATION</Text>
        <Text style={styles.item}>Notifications</Text>
        <Text style={styles.item}>Privacy & Security</Text>
        <Text style={styles.item}>About TransConet</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
    backgroundColor: "#F5F7FA",
  },
  back: {
    marginTop: 10,
    color: "#0B63CE",
    fontSize: 16,
    fontWeight: "700",
  },
  eyebrow: {
    marginTop: 28,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#0B63CE",
  },
  title: {
    marginTop: 5,
    fontSize: 30,
    fontWeight: "800",
    color: "#101828",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 15,
    lineHeight: 21,
    color: "#667085",
  },
  card: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
  },
  section: {
    marginBottom: 14,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.3,
    color: "#667085",
  },
  item: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F4F7",
    fontSize: 15,
    fontWeight: "700",
    color: "#344054",
  },
});
