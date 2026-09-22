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
    backgroundColor: "#F4F7FF",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#4169E1",
  },
  title: {
    fontSize: 29,
    lineHeight: 35,
    fontWeight: "900",
    color: "#101B3A",
    marginTop: 5,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
    marginTop: 7,
  },
  tabs: {
    flexDirection: "row",
    marginHorizontal: 18,
    marginTop: 14,
    marginBottom: 4,
    padding: 4,
    borderRadius: 16,
    backgroundColor: "#E9EEFF",
    borderWidth: 1,
    borderColor: "#D9E2FF",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: "#4169E1",
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 7,
    elevation: 3,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#667085",
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  content: {
    flex: 1,
  },
});
