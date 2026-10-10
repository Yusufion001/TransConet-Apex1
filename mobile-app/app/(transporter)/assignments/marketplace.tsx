import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../../src/auth/auth.store";
import { getTransporterMarketplaceAssignments } from "../../../src/api/transporter";

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function statusColor(status: string) {
  switch (status) {
    case "ASSIGNED":
      return "#175CD3";
    case "ACCEPTED":
      return "#027A48";
    case "DRIVER_ARRIVING":
      return "#B54708";
    case "ARRIVED":
      return "#7A5AF8";
    case "IN_TRANSIT":
      return "#087443";
    case "COMPLETED":
      return "#344054";
    case "CANCELLED":
      return "#B42318";
    default:
      return "#667085";
  }
}

export default function TransporterBookings() {
  const user = useAuthStore((state) => state.user);

  const query = useQuery({
    queryKey: ["transporter-marketplace-assignments", user?.id],
    queryFn: () => getTransporterMarketplaceAssignments(user!.id),
    enabled: Boolean(user?.id),
  });

  if (query.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading assignments...</Text>
      </View>
    );
  }

  if (query.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Unable to load assignments</Text>
        <Text style={styles.errorText}>
          Check your connection and try again.
        </Text>

        <Pressable onPress={() => query.refetch()} style={styles.button}>
          <Text style={styles.buttonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const bookings = query.data ?? [];

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => query.refetch()}
        />
      }
    >

      <View style={styles.summary}>
        <View>
          <Text style={styles.summaryNumber}>{bookings.length}</Text>
          <Text style={styles.summaryLabel}>TOTAL ASSIGNMENTS</Text>
        </View>

        <View style={styles.summaryDivider} />

        <View>
          <Text style={styles.summaryNumber}>
            {
              bookings.filter(
                (booking) =>
                  !["COMPLETED", "CANCELLED"].includes(booking.status),
              ).length
            }
          </Text>
          <Text style={styles.summaryLabel}>ACTIVE</Text>
        </View>
      </View>

      {bookings.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No Marketplace assignments yet</Text>
          <Text style={styles.emptyText}>
            Marketplace shipments assigned to you will appear here.
          </Text>
        </View>
      ) : (
        bookings.map((booking) => (
          <Link
            key={booking.id}
            href={`/(transporter)/bookings/${booking.id}`}
            asChild
          >
            <Pressable style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: `${statusColor(booking.status)}15` },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: statusColor(booking.status) },
                      ]}
                    >
                      {statusLabel(booking.status)}
                    </Text>
                  </View>

                  {booking.paymentMethod === "NEGOTIATE" && (
                    <View style={styles.negotiatedBadge}>
                      <Text style={styles.negotiatedBadgeText}>
                        NEGOTIATED
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={styles.id}>
                  #{booking.id.slice(0, 8).toUpperCase()}
                </Text>
              </View>

              <View style={styles.route}>
                <View style={styles.routeLine}>
                  <View style={styles.pickupDot} />
                  <Text style={styles.routeLabel}>PICKUP</Text>
                </View>

                <Text style={styles.location}>
                  {booking.pickupLocation}
                </Text>

                <View style={styles.connector} />

                <View style={styles.routeLine}>
                  <View style={styles.destinationDot} />
                  <Text style={styles.routeLabel}>DESTINATION</Text>
                </View>

                <Text style={styles.location}>
                  {booking.destination}
                </Text>
              </View>

              <View style={styles.cardBottom}>
                <Text style={styles.meta}>
                  {booking.truckCategory.replace(/_/g, " ")}
                </Text>

                <Text style={styles.meta}>
                  {booking.cargoWeight} cargo
                </Text>

                <Text style={styles.open}>View →</Text>
              </View>
            </Pressable>
          </Link>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    backgroundColor: "#F7F9FE",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F7F9FE",
  },
  loadingText: {
    marginTop: 12,
    color: "#667085",
    fontSize: 14,
    fontWeight: "600",
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5EAF4",
  },
  summaryNumber: {
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "800",
    color: "#101B3A",
  },
  summaryLabel: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#667085",
  },
  summaryDivider: {
    width: 1,
    height: 38,
    backgroundColor: "#E5EAF4",
    marginHorizontal: 22,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 15,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: "#E5EAF4",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    flex: 1,
    paddingRight: 8,
  },
  negotiatedBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: "#FFF7E8",
    borderWidth: 1,
    borderColor: "#F1D59A",
  },
  negotiatedBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: "#7A4E00",
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  id: {
    fontSize: 10,
    color: "#8791A4",
    fontWeight: "700",
  },
  route: {
    marginTop: 15,
  },
  routeLine: {
    flexDirection: "row",
    alignItems: "center",
  },
  pickupDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#4169E1",
    marginRight: 8,
  },
  destinationDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#101B3A",
    marginRight: 8,
  },
  routeLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#8791A4",
  },
  location: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21,
    color: "#101B3A",
    marginTop: 6,
  },
  connector: {
    height: 18,
    width: 2,
    backgroundColor: "#DCE3F0",
    marginLeft: 4,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 13,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: "#E8ECF5",
  },
  meta: {
    fontSize: 11,
    color: "#667085",
    fontWeight: "600",
    marginRight: 12,
  },
  open: {
    marginLeft: "auto",
    fontSize: 12,
    fontWeight: "800",
    color: "#4169E1",
  },
  empty: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5EAF4",
  },
  emptyTitle: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "800",
    color: "#101B3A",
    textAlign: "center",
  },
  emptyText: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 20,
    color: "#667085",
    marginTop: 8,
  },
  errorTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#101B3A",
    textAlign: "center",
  },
  errorText: {
    color: "#667085",
    marginTop: 7,
    textAlign: "center",
    lineHeight: 21,
  },
  button: {
    backgroundColor: "#4169E1",
    borderRadius: 11,
    paddingHorizontal: 22,
    paddingVertical: 13,
    marginTop: 17,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
