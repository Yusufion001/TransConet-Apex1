import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  getMarketplaceDiscoveryConfig,
  getMarketplaceLoads,
} from "../../../src/api/transporter";
import {
  listenForMarketplaceDiscoveryUpdates,
} from "../../../src/realtime/marketplace-realtime";

function formatDate(value?: string | null) {
  if (!value) return "Schedule not specified";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Schedule not specified";
  }

  return date.toLocaleDateString();
}

export default function TransporterMarketplace() {
  const queryClient = useQueryClient();

  const [selectedRadiusKm, setSelectedRadiusKm] = useState<
    number | undefined
  >(undefined);

  const discoveryConfigQuery = useQuery({
    queryKey: ["transporter-marketplace-discovery-config"],
    queryFn: getMarketplaceDiscoveryConfig,
  });

  useEffect(() => {
    const defaultRadiusKm = discoveryConfigQuery.data?.defaultRadiusKm;

    if (
      selectedRadiusKm === undefined &&
      typeof defaultRadiusKm === "number" &&
      Number.isFinite(defaultRadiusKm) &&
      defaultRadiusKm > 0
    ) {
      setSelectedRadiusKm(defaultRadiusKm);
    }
  }, [discoveryConfigQuery.data?.defaultRadiusKm, selectedRadiusKm]);

  const query = useQuery({
    queryKey: ["transporter-marketplace", selectedRadiusKm],
    queryFn: () => getMarketplaceLoads(selectedRadiusKm),
    enabled:
      discoveryConfigQuery.isSuccess &&
      selectedRadiusKm !== undefined,
    refetchInterval:
      discoveryConfigQuery.data?.marketplaceRefreshSeconds ?? false,
  });

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void listenForMarketplaceDiscoveryUpdates(() => {
      void queryClient.invalidateQueries({
        queryKey: ["transporter-marketplace"],
      });
    })
      .then((cleanup) => {
        if (cancelled) {
          cleanup();
          return;
        }

        unsubscribe = cleanup;
      })
      .catch(() => {
        // Marketplace data remains available through the existing query/manual refresh.
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [queryClient]);

  const nextRadiusKm =
    discoveryConfigQuery.data && selectedRadiusKm !== undefined
      ? discoveryConfigQuery.data.radiusRingsKm
          .filter(
            (radiusKm) =>
              radiusKm > selectedRadiusKm &&
              radiusKm <= discoveryConfigQuery.data.maxRadiusKm,
          )
          .sort((a, b) => a - b)[0]
      : undefined;

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

      {nextRadiusKm !== undefined ? (
        <View style={styles.discoveryCard}>
          <View>
            <Text style={styles.discoveryLabel}>DISCOVERY RANGE</Text>
            <Text style={styles.discoveryText}>
              Searching within {selectedRadiusKm} km
            </Text>
          </View>

          <Pressable
            onPress={() => setSelectedRadiusKm(nextRadiusKm)}
            style={styles.discoveryButton}
          >
            <Text style={styles.discoveryButtonText}>
              Expand to {nextRadiusKm} km
            </Text>
          </Pressable>
        </View>
      ) : null}

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
                router.push({
                  pathname: "/(transporter)/marketplace/[id]",
                  params: {
                    id: load.id,
                    radiusKm: String(selectedRadiusKm),
                  },
                })
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
    paddingTop: 28,
    paddingBottom: 44,
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
    marginTop: 12,
    color: "#667085",
    fontSize: 14,
    textAlign: "center",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.8,
    color: "#4169E1",
  },
  title: {
    marginTop: 5,
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "900",
    color: "#101B3A",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 21,
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
  },
  discoveryCard: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E1E7F5",
    shadowColor: "#101B3A",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  discoveryLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: "#667085",
  },
  discoveryText: {
    marginTop: 5,
    fontSize: 15,
    fontWeight: "800",
    color: "#101B3A",
  },
  discoveryButton: {
    marginTop: 14,
    minHeight: 47,
    borderRadius: 13,
    paddingHorizontal: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4169E1",
  },
  discoveryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  statusCard: {
    padding: 19,
    borderRadius: 20,
    backgroundColor: "#101B3A",
    marginBottom: 18,
    shadowColor: "#101B3A",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
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
    backgroundColor: "#35C98A",
  },
  statusTitle: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#FFFFFF",
  },
  statusText: {
    marginTop: 9,
    color: "#DCE4F5",
    fontSize: 13,
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
    shadowOpacity: 0.045,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#F0F4FF",
    fontSize: 10,
    fontWeight: "800",
    color: "#667085",
    overflow: "hidden",
  },
  location: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "900",
    color: "#101B3A",
  },
  arrow: {
    marginVertical: 3,
    fontSize: 18,
    fontWeight: "800",
    color: "#4169E1",
  },
  divider: {
    height: 1,
    backgroundColor: "#E8ECF5",
    marginVertical: 17,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
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
    minHeight: 51,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#4169E1",
    shadowColor: "#4169E1",
    shadowOpacity: 0.16,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
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
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E1E7F5",
    shadowColor: "#101B3A",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#101B3A",
    textAlign: "center",
  },
  emptyText: {
    marginTop: 9,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 21,
    color: "#667085",
  },
  button: {
    marginTop: 17,
    minHeight: 47,
    borderRadius: 13,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#101B3A",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  errorTitle: {
    textAlign: "center",
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "900",
    color: "#101B3A",
  },
  errorText: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 21,
    color: "#667085",
  },
});
