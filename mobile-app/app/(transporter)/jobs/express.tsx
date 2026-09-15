import React from "react";
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
import {
  acceptExpressBooking,
  getExpressGeneralBoard,
  type ExpressGeneralBoardLoad,
} from "../../../src/api/express";

function money(value: string, currency: string) {
  const amount = Number(value);

  if (currency === "NGN" && Number.isFinite(amount)) {
    return `₦${amount.toLocaleString()}`;
  }

  return `${currency} ${value}`;
}

function formatScheduledDate(value: string | null) {
  if (!value) {
    return "As soon as possible";
  }

  return new Date(value).toLocaleString();
}

function ExpressBoardCard({
  load,
  onAccepted,
}: {
  load: ExpressGeneralBoardLoad;
  onAccepted: () => void;
}) {
  const [accepting, setAccepting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleAccept = async () => {
    if (accepting) {
      return;
    }

    setAccepting(true);
    setError(null);

    try {
      await acceptExpressBooking(load.expressBookingId, load.vehicleId);
      onAccepted();
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "Unable to accept this Express load",
      );
    } finally {
      setAccepting(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.boardBadge}>
          <Text style={styles.boardBadgeText}>GENERAL BOARD</Text>
        </View>
        <Text style={styles.distance}>
          {load.distanceKm.toFixed(1)} km
        </Text>
      </View>

      <Text style={styles.routeLabel}>Pickup</Text>
      <Text style={styles.location}>{load.pickupLocation}</Text>

      {load.pickupLandmark ? (
        <Text style={styles.detail}>{load.pickupLandmark}</Text>
      ) : null}

      <Text style={styles.routeLabel}>Destination</Text>
      <Text style={styles.location}>{load.destination}</Text>

      {load.destinationLandmark ? (
        <Text style={styles.detail}>{load.destinationLandmark}</Text>
      ) : null}

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Cargo</Text>
      <Text style={styles.value}>
        {load.cargoWeight.toLocaleString()} kg
      </Text>

      <Text style={styles.detail}>
        {load.packageCount} package
        {load.packageCount === 1 ? "" : "s"} · {load.packagingType}
      </Text>

      {load.cargoDescription ? (
        <Text style={styles.detail}>{load.cargoDescription}</Text>
      ) : null}

      <Text style={styles.routeLabel}>Scheduled</Text>
      <Text style={styles.value}>
        {formatScheduledDate(load.scheduledDate)}
      </Text>

      <View style={styles.fareRow}>
        <View>
          <Text style={styles.routeLabel}>Express Fare</Text>
          <Text style={styles.fare}>
            {money(load.fare, load.currency)}
          </Text>
        </View>

        <Text style={styles.tier}>
          {load.transporterTier ?? "STANDARD"}
        </Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable
        style={[
          styles.acceptButton,
          accepting ? styles.acceptButtonDisabled : null,
        ]}
        disabled={accepting}
        onPress={() => void handleAccept()}
      >
        {accepting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.acceptText}>Accept Express Load</Text>
        )}
      </Pressable>
    </View>
  );
}

export default function ExpressIndexScreen() {
  const boardQuery = useQuery({
    queryKey: ["express-general-board"],
    queryFn: getExpressGeneralBoard,
    refetchInterval: 15_000,
  });

  const handleAccepted = () => {
    void boardQuery.refetch();
  };

  if (boardQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>
          Loading General Express Board...
        </Text>
      </View>
    );
  }

  if (boardQuery.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>
          Unable to load Express Board
        </Text>
        <Text style={styles.errorText}>
          {boardQuery.error instanceof Error
            ? boardQuery.error.message
            : "Please try again."}
        </Text>

        <Pressable
          style={styles.button}
          onPress={() => void boardQuery.refetch()}
        >
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const loads = boardQuery.data ?? [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={boardQuery.isRefetching}
          onRefresh={() => void boardQuery.refetch()}
        />
      }
    >
      <Text style={styles.title}>Express Board</Text>

      <Text style={styles.subtitle}>
        Express loads that were not accepted during nearby dispatch are
        available here for eligible transporters.
      </Text>

      {loads.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No Express loads available</Text>
          <Text style={styles.emptyText}>
            New General Board loads will appear here automatically.
          </Text>
        </View>
      ) : (
        loads.map((load) => (
          <ExpressBoardCard
            key={load.expressBookingId}
            load={load}
            onAccepted={handleAccepted}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#FFFFFF",
  },
  loadingText: {
    marginTop: 10,
    color: "#667085",
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "#101828",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 18,
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
  },
  card: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EAECF0",
    backgroundColor: "#FFFFFF",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  boardBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#EEF4FF",
  },
  boardBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#0B63CE",
  },
  distance: {
    fontSize: 13,
    fontWeight: "800",
    color: "#667085",
  },
  routeLabel: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: "800",
    color: "#667085",
    textTransform: "uppercase",
  },
  location: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "800",
    color: "#101828",
  },
  detail: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: "#667085",
  },
  divider: {
    height: 1,
    marginVertical: 14,
    backgroundColor: "#EAECF0",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#101828",
  },
  value: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: "700",
    color: "#101828",
  },
  fareRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 8,
  },
  fare: {
    marginTop: 3,
    fontSize: 24,
    fontWeight: "900",
    color: "#101828",
  },
  tier: {
    fontSize: 11,
    fontWeight: "800",
    color: "#667085",
  },
  acceptButton: {
    marginTop: 18,
    minHeight: 52,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B63CE",
  },
  acceptButtonDisabled: {
    opacity: 0.6,
  },
  acceptText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  emptyCard: {
    padding: 22,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EAECF0",
    backgroundColor: "#FFFFFF",
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#101828",
  },
  emptyText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#101828",
    textAlign: "center",
  },
  errorText: {
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
    color: "#B42318",
  },
  button: {
    marginTop: 20,
    minWidth: 120,
    minHeight: 46,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B63CE",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
