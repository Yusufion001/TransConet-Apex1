import { router } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

function SettingsItem({
  title,
  description,
  onPress,
}: {
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
    >
      <View style={styles.itemText}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.itemDescription}>{description}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default function TransporterSettings() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>

      <Text style={styles.eyebrow}>TRANSCONET</Text>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>
        Manage your transporter application preferences and account access.
      </Text>

      <View style={styles.card}>
        <Text style={styles.section}>APPLICATION</Text>

        <SettingsItem
          title="Notifications"
          description="View and manage your TransConet notifications."
          onPress={() => router.push("/(transporter)/notifications")}
        />

        <SettingsItem
          title="Privacy & Security"
          description="Manage your account information and security."
          onPress={() => router.push("/(transporter)/account")}
        />

        <SettingsItem
          title="About TransConet"
          description="Learn about the TransConet transporter platform."
          onPress={() =>
            Alert.alert(
              "About TransConet",
              "TransConet is a transport and logistics platform connecting customers with verified transporters and supporting reliable fleet operations."
            )
          }
        />
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
    marginBottom: 4,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.3,
    color: "#667085",
  },
  item: {
    minHeight: 72,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F2F4F7",
  },
  itemPressed: {
    opacity: 0.6,
  },
  itemText: {
    flex: 1,
    paddingRight: 12,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#344054",
  },
  itemDescription: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: "#667085",
  },
  chevron: {
    fontSize: 28,
    fontWeight: "300",
    color: "#98A2B3",
  },
});
