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
    padding: 20,
    paddingTop: 58,
    paddingBottom: 40,
    backgroundColor: "#F5F7FA",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F5F7FA",
  },
  loadingText: {
    marginTop: 12,
    color: "#667085",
    fontSize: 14,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.6,
    color: "#0B63CE",
  },
  title: {
    marginTop: 5,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    color: "#101828",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 22,
    fontSize: 15,
    lineHeight: 22,
    color: "#667085",
  },
  statusCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: "#101828",
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#12B76A",
  },
  statusTitle: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: "#FFFFFF",
  },
  statusText: {
    marginTop: 9,
    color: "#D0D5DD",
    fontSize: 14,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E4E7EC",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: "#0B63CE",
  },
  cardId: {
    fontSize: 11,
    color: "#98A2B3",
  },
  location: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: "#1D2939",
  },
  arrow: {
    marginVertical: 4,
    fontSize: 18,
    color: "#98A2B3",
  },
  divider: {
    height: 1,
    backgroundColor: "#EAECF0",
    marginVertical: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 9,
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
    fontWeight: "700",
    color: "#344054",
  },
  description: {
    marginTop: 7,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#EAECF0",
    fontSize: 13,
    lineHeight: 19,
    color: "#667085",
  },
  bidButton: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: 13,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0B63CE",
  },
  bidButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  bidArrow: {
    color: "#FFFFFF",
    fontSize: 21,
  },
  empty: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E4E7EC",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#101828",
  },
  emptyText: {
    marginTop: 9,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
  },
  button: {
    marginTop: 16,
    borderRadius: 13,
    paddingHorizontal: 20,
    paddingVertical: 13,
    backgroundColor: "#101828",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  errorTitle: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: "#101828",
  },
  errorText: {
    marginTop: 8,
    textAlign: "center",
    lineHeight: 21,
    color: "#667085",
  },
});
