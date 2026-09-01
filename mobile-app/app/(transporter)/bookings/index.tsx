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
  },
  loadingText: {
    marginTop: 12,
    color: "#667085",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.6,
    color: "#0B63CE",
  },
  title: {
    fontSize: 31,
    fontWeight: "800",
    color: "#101828",
    marginTop: 5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#667085",
    marginTop: 7,
    marginBottom: 20,
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#101828",
    borderRadius: 18,
    padding: 20,
    marginBottom: 18,
  },
  summaryNumber: {
    fontSize: 25,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "#98A2B3",
    marginTop: 3,
  },
  summaryDivider: {
    width: 1,
    height: 38,
    backgroundColor: "#344054",
    marginHorizontal: 28,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EAECF0",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    fontSize: 11,
    color: "#98A2B3",
    fontWeight: "700",
  },
  route: {
    marginTop: 20,
  },
  routeLine: {
    flexDirection: "row",
    alignItems: "center",
  },
  pickupDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#0B63CE",
    marginRight: 8,
  },
  destinationDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#101828",
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
    fontWeight: "700",
    lineHeight: 22,
    color: "#1D2939",
    marginTop: 5,
  },
  connector: {
    height: 17,
    width: 1,
    backgroundColor: "#D0D5DD",
    marginLeft: 4,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F2F4F7",
  },
  meta: {
    fontSize: 11,
    color: "#667085",
    marginRight: 12,
  },
  open: {
    marginLeft: "auto",
    fontSize: 12,
    fontWeight: "800",
    color: "#0B63CE",
  },
  empty: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EAECF0",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#101828",
  },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
    marginTop: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#101828",
  },
  errorText: {
    color: "#667085",
    marginTop: 6,
  },
  button: {
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
    marginTop: 16,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
