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
import { getTransporterBookings } from "../../../src/api/bookings";

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
    queryKey: ["transporter-bookings", user?.id],
    queryFn: () => getTransporterBookings(user!.id),
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
      <Text style={styles.eyebrow}>TRANSPORTER OPERATIONS</Text>
      <Text style={styles.title}>Assignments</Text>
      <Text style={styles.subtitle}>
        Manage your assigned shipments from acceptance through delivery.
      </Text>

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
          <Text style={styles.emptyTitle}>No assignments yet</Text>
          <Text style={styles.emptyText}>
            Shipments assigned to you will appear here.
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
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 42,
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
    marginBottom: 18,
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#101B3A",
    borderRadius: 21,
    padding: 19,
    marginBottom: 18,
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 5,
  },
  summaryNumber: {
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "#AEB9D5",
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#344263",
    marginHorizontal: 28,
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
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
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
    fontWeight: "900",
    letterSpacing: 0.7,
    color: "#7A4E00",
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  id: {
    fontSize: 10,
    color: "#98A2B3",
    fontWeight: "800",
  },
  route: {
    marginTop: 20,
  },
  routeLine: {
    flexDirection: "row",
    alignItems: "center",
  },
  pickupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#4169E1",
    marginRight: 8,
  },
  destinationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#101B3A",
    marginRight: 8,
  },
  routeLabel: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "#98A2B3",
  },
  location: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    color: "#101B3A",
    marginTop: 6,
  },
  connector: {
    height: 18,
    width: 2,
    backgroundColor: "#DCE3F3",
    marginLeft: 4,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    paddingTop: 14,
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
    fontWeight: "900",
    color: "#4169E1",
  },
  empty: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 28,
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
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
    marginTop: 8,
  },
  errorTitle: {
    fontSize: 19,
    fontWeight: "900",
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
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
    marginTop: 17,
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
});
