import { useState } from "react";
import { router } from "expo-router";
import { TransporterAccountScreen } from "./account";
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

function TransporterSettings() {
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
          title="Subscription & Visibility"
          description="Manage your marketplace subscription and transporter visibility."
          onPress={() => router.push("/(transporter)/subscription")}
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
    backgroundColor: "#F7F9FE",
  },
  back: {
    marginBottom: 14,
    color: "#4169E1",
    fontSize: 14,
    fontWeight: "700",
  },
  eyebrow: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: "#4169E1",
  },
  title: {
    marginTop: 5,
    fontSize: 28,
    lineHeight: 35,
    fontWeight: "800",
    color: "#101B3A",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 22,
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
  },
  card: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 2,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5EAF4",
  },
  section: {
    marginBottom: 3,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#7A8498",
  },
  item: {
    minHeight: 72,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#EDF0F6",
  },
  itemPressed: {
    opacity: 0.65,
  },
  itemText: {
    flex: 1,
    paddingRight: 14,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#17233F",
  },
  itemDescription: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    color: "#707B90",
  },
  chevron: {
    fontSize: 27,
    lineHeight: 30,
    fontWeight: "300",
    color: "#98A2B3",
  },
});

export { TransporterSettings };

function TransporterSettingsAndAccount() {
  const [activeTab, setActiveTab] = useState<"account" | "settings">("account");

  return (
    <View style={combinedStyles.screen}>
      <View style={combinedStyles.header}>
        <Text style={combinedStyles.eyebrow}>TRANSPORTER CONFIGURATION</Text>
        <Text style={combinedStyles.title}>Settings</Text>
        <Text style={combinedStyles.subtitle}>
          Manage your account information and application preferences from one place.
        </Text>
      </View>

      <View style={combinedStyles.tabs}>
        <Pressable
          style={[
            combinedStyles.tab,
            activeTab === "account" && combinedStyles.activeTab,
          ]}
          onPress={() => setActiveTab("account")}
        >
          <Text
            style={[
              combinedStyles.tabText,
              activeTab === "account" && combinedStyles.activeTabText,
            ]}
          >
            Account
          </Text>
        </Pressable>

        <Pressable
          style={[
            combinedStyles.tab,
            activeTab === "settings" && combinedStyles.activeTab,
          ]}
          onPress={() => setActiveTab("settings")}
        >
          <Text
            style={[
              combinedStyles.tabText,
              activeTab === "settings" && combinedStyles.activeTabText,
            ]}
          >
            App Settings
          </Text>
        </Pressable>
      </View>

      <View style={combinedStyles.content}>
        {activeTab === "account" ? (
          <TransporterAccountScreen />
        ) : (
          <TransporterSettings />
        )}
      </View>
    </View>
  );
}

const combinedStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F9FE",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E8ECF5",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: "#4169E1",
  },
  title: {
    marginTop: 5,
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "800",
    color: "#101B3A",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: "#667085",
  },
  tabs: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 5,
    padding: 4,
    borderRadius: 12,
    backgroundColor: "#EDF1F9",
    borderWidth: 1,
    borderColor: "#E1E7F2",
  },
  tab: {
    flex: 1,
    minHeight: 43,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  activeTab: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#667085",
  },
  activeTabText: {
    color: "#4169E1",
    fontWeight: "800",
  },
  content: {
    flex: 1,
  },
});

export default TransporterSettingsAndAccount;
