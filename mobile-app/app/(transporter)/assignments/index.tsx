import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import MarketplaceAssignments from "./marketplace";
import ExpressAssignments from "./express";

type AssignmentTab = "marketplace" | "express";

export default function AssignmentsScreen() {
  const params = useLocalSearchParams<{ type?: string }>();

  const activeTab: AssignmentTab =
    params.type === "express" ? "express" : "marketplace";

  const selectTab = (type: AssignmentTab) => {
    router.setParams({ type });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>TRANSPORTER OPERATIONS</Text>
        <Text style={styles.title}>My Assignments</Text>
        <Text style={styles.subtitle}>
          Manage Marketplace and Express shipments from one place.
        </Text>
      </View>

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === "marketplace" && styles.activeTab]}
          onPress={() => selectTab("marketplace")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "marketplace" && styles.activeTabText,
            ]}
          >
            Marketplace
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === "express" && styles.activeTab]}
          onPress={() => selectTab("express")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "express" && styles.activeTabText,
            ]}
          >
            Express
          </Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {activeTab === "express" ? (
          <ExpressAssignments />
        ) : (
          <MarketplaceAssignments />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    borderBottomColor: "#E5EAF4",
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
    marginTop: 7,
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
    alignItems: "center",
    justifyContent: "center",
    minHeight: 43,
    borderRadius: 9,
  },
  activeTab: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE5FF",
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
