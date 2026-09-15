import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import MarketplaceJobs from "./marketplace";
import ExpressJobs from "./express";

type JobsTab = "marketplace" | "express";

export default function JobsScreen() {
  const params = useLocalSearchParams<{ type?: string }>();

  const activeTab: JobsTab =
    params.type === "express" ? "express" : "marketplace";

  const selectTab = (type: JobsTab) => {
    router.setParams({ type });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>TRANSPORT OPPORTUNITIES</Text>
        <Text style={styles.title}>Browse Jobs</Text>
        <Text style={styles.subtitle}>
          Find available Marketplace and Express transport opportunities.
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
        {activeTab === "express" ? <ExpressJobs /> : <MarketplaceJobs />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: "#0B63CE",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#101828",
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#667085",
    marginTop: 5,
  },
  tabs: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
    padding: 4,
    borderRadius: 12,
    backgroundColor: "#EAECF0",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    borderRadius: 9,
  },
  activeTab: {
    backgroundColor: "#FFFFFF",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#667085",
  },
  activeTabText: {
    color: "#101828",
  },
  content: {
    flex: 1,
  },
});
