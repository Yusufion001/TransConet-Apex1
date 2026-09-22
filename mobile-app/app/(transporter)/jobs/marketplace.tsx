import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { getMarketplaceLoads } from "../../../src/api/transporter";

function formatDate(value?: string | null) {
  if (!value) return "Schedule not specified";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Schedule not specified";
  }

  return date.toLocaleDateString();
}

export default function TransporterMarketplace() {
  const query = useQuery({
    queryKey: ["transporter-marketplace"],
    queryFn: () => getMarketplaceLoads(),
  });

  if (query.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Finding transport opportunities...</Text>
      </View>
    );
  }

  if (query.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Unable to load Capacity Exchange</Text>
        <Text style={styles.errorText}>
          We could not retrieve the available transport opportunities.
        </Text>

        <Pressable onPress={() => query.refetch()} style={styles.button}>
          <Text style={styles.buttonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const loads = query.data ?? [];

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => {
            void query.refetch();
          }}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>MARKETPLACE</Text>

      <Text style={styles.title}>Capacity Exchange</Text>

      <Text style={styles.subtitle}>
        Discover transport opportunities that match your operational capacity.
      </Text>

      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusTitle}>LIVE OPPORTUNITIES</Text>
        </View>

        <Text style={styles.statusText}>
          {loads.length} opportunity{loads.length === 1 ? "" : "ies"} currently
          available.
        </Text>
      </View>

      {loads.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No opportunities available</Text>

          <Text style={styles.emptyText}>
            New transport requests will appear here when they become available
            to your transporter account.
          </Text>

          <Pressable
            onPress={() => query.refetch()}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Refresh Exchange</Text>
          </Pressable>
        </View>
      ) : (
        loads.map((load) => (
          <View key={load.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>OPPORTUNITY</Text>

              <Text style={styles.cardId}>
                #{load.id.slice(0, 8)}
              </Text>
            </View>

            <Text style={styles.location}>{load.pickupLocation}</Text>

            <Text style={styles.arrow}>↓</Text>

            <Text style={styles.location}>{load.destination}</Text>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>TRUCK</Text>
              <Text style={styles.detailValue}>
                {load.truckCategory}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>CARGO</Text>
              <Text style={styles.detailValue}>
                {load.cargoCategory ?? "GENERAL"}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>WEIGHT</Text>
              <Text style={styles.detailValue}>
                {String(load.cargoWeight)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>SCHEDULE</Text>
              <Text style={styles.detailValue}>
                {formatDate(load.scheduledDate)}
              </Text>
            </View>

            {load.cargoDescription ? (
              <Text style={styles.description}>
                {load.cargoDescription}
              </Text>
            ) : null}

            <Pressable
              style={styles.bidButton}
              onPress={() =>
                router.push(`/(transporter)/marketplace/${load.id}`)
              }
            >
              <Text style={styles.bidButtonText}>View Opportunity</Text>
              <Text style={styles.bidArrow}>→</Text>
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 40,
    backgroundColor: "#F4F7FF",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F4F7FF",
  },
  loadingText: {
    marginTop: 14,
    color: "#667085",
    fontSize: 14,
    fontWeight: "600",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.6,
    color: "#4169E1",
  },
  title: {
    marginTop: 5,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: "900",
    color: "#101B3A",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 18,
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
  },
  statusCard: {
    padding: 19,
    borderRadius: 20,
    backgroundColor: "#101B3A",
    marginBottom: 18,
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 5,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#35D07F",
  },
  statusTitle: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: "#FFFFFF",
  },
  statusText: {
    marginTop: 9,
    color: "#D6DCF0",
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#E1E7F5",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 17,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: "#4169E1",
  },
  cardId: {
    fontSize: 11,
    fontWeight: "600",
    color: "#98A2B3",
  },
  location: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "800",
    color: "#101B3A",
  },
  arrow: {
    marginVertical: 3,
    fontSize: 19,
    fontWeight: "800",
    color: "#4169E1",
  },
  divider: {
    height: 1,
    backgroundColor: "#E8ECF5",
    marginVertical: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    minHeight: 24,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#98A2B3",
  },
  detailValue: {
    maxWidth: "65%",
    textAlign: "right",
    fontSize: 13,
    fontWeight: "800",
    color: "#344054",
  },
  description: {
    marginTop: 7,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "#E8ECF5",
    fontSize: 13,
    lineHeight: 20,
    color: "#667085",
  },
  bidButton: {
    marginTop: 17,
    minHeight: 50,
    borderRadius: 15,
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#4169E1",
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 9,
    elevation: 4,
  },
  bidButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  bidArrow: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "700",
  },
  empty: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 26,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E1E7F5",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#101B3A",
    textAlign: "center",
  },
  emptyText: {
    marginTop: 9,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
  },
  button: {
    marginTop: 17,
    borderRadius: 14,
    paddingHorizontal: 21,
    paddingVertical: 13,
    backgroundColor: "#4169E1",
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 7,
    elevation: 3,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  errorTitle: {
    textAlign: "center",
    fontSize: 19,
    fontWeight: "900",
    color: "#101B3A",
  },
  errorText: {
    marginTop: 8,
    textAlign: "center",
    lineHeight: 21,
    color: "#667085",
  },
});
