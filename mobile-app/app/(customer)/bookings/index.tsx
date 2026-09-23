import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../../src/auth/auth.store";
import { getCustomerBookings } from "../../../src/api/bookings";

export default function CustomerBookings() {
  const user = useAuthStore((state) => state.user);

  const query = useQuery({
    queryKey: ["customer-bookings", user?.id],
    queryFn: () => getCustomerBookings(user!.id),
    enabled: Boolean(user?.id),
  });

  if (query.isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  if (query.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Unable to load your shipments.</Text>
        <Pressable onPress={() => query.refetch()} style={styles.button}>
          <Text style={styles.buttonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const bookings = query.data ?? [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.eyebrow}>
          <Ionicons name="cube-outline" size={13} color="#4169E1" />
          <Text style={styles.eyebrowText}>SHIPMENTS</Text>
        </View>
        <Text style={styles.title}>Your Shipments</Text>
        <Text style={styles.subtitle}>
          Track requests, active transport, and completed deliveries.
        </Text>
      </View>

      {bookings.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="cube-outline" size={28} color="#4169E1" />
          </View>
          <Text style={styles.emptyTitle}>No shipments yet</Text>
          <Text style={styles.emptyText}>
            Create your first shipment and TransConet will take it from there.
          </Text>
          <Link href="/(customer)/bookings/create" asChild>
            <Pressable style={styles.button}>
              <Text style={styles.buttonText}>Book Transport</Text>
            </Pressable>
          </Link>
        </View>
      ) : (
        bookings.map((booking) => (
          <Link
            key={booking.id}
            href={`/(customer)/bookings/${booking.id}`}
            asChild
          >
            <Pressable style={styles.card}>
              <View style={styles.row}>
                <View style={styles.badgeRow}>
                  <View style={styles.statusBadge}>
                    <Ionicons name="radio-button-on" size={11} color="#4169E1" />
                    <Text style={styles.status}>{booking.status}</Text>
                  </View>
                  {booking.paymentMethod === "NEGOTIATE" && (
                    <View style={styles.negotiatedBadge}>
                      <Text style={styles.negotiatedBadgeText}>
                        NEGOTIATED
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.id}>#{booking.id.slice(0, 8)}</Text>
              </View>

              <View style={styles.routeBlock}>
                <View style={styles.routeIconColumn}>
                  <View style={styles.routeDot} />
                  <View style={styles.routeLine} />
                  <Ionicons name="location" size={16} color="#4169E1" />
                </View>
                <View style={styles.routeTextColumn}>
                  <Text style={styles.routeLabel}>PICKUP</Text>
                  <Text style={styles.location}>{booking.pickupLocation}</Text>
                  <View style={styles.routeGap} />
                  <Text style={styles.routeLabel}>DESTINATION</Text>
                  <Text style={styles.location}>{booking.destination}</Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.date}>
                  {new Date(booking.createdAt).toLocaleDateString()}
                </Text>
                <View style={styles.openAction}>
                  <Text style={styles.openActionText}>View shipment</Text>
                  <Ionicons name="arrow-forward" size={15} color="#4169E1" />
                </View>
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
    paddingBottom: 36,
    backgroundColor: "#F4F7FF",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F4F7FF",
  },
  header: {
    marginTop: 20,
    marginBottom: 18,
  },
  eyebrow: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EAF0FF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  eyebrowText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#4169E1",
  },
  title: {
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "800",
    color: "#101B3A",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
    marginTop: 7,
    maxWidth: 360,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 17,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: "#E7ECF6",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 17,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#EAF0FF",
  },
  status: {
    fontSize: 10,
    fontWeight: "900",
    color: "#4169E1",
    letterSpacing: 0.4,
  },
  negotiatedBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "#FFF7E8",
    borderWidth: 1,
    borderColor: "#F2C94C",
  },
  negotiatedBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
    color: "#7A4E00",
  },
  id: {
    fontSize: 11,
    fontWeight: "700",
    color: "#98A2B3",
  },
  routeBlock: {
    flexDirection: "row",
    minHeight: 116,
  },
  routeIconColumn: {
    width: 25,
    alignItems: "center",
    paddingTop: 5,
  },
  routeDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#4169E1",
  },
  routeLine: {
    width: 1,
    flex: 1,
    backgroundColor: "#C7D4F2",
    marginVertical: 4,
  },
  routeTextColumn: {
    flex: 1,
    paddingLeft: 9,
  },
  routeLabel: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.9,
    color: "#98A2B3",
    marginBottom: 3,
  },
  location: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: "#1D2939",
  },
  routeGap: {
    height: 18,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "#F0F2F5",
  },
  date: {
    fontSize: 11,
    color: "#98A2B3",
  },
  openAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  openActionText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#4169E1",
  },
  empty: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E7ECF6",
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF0FF",
    marginBottom: 13,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#101B3A",
  },
  emptyText: {
    textAlign: "center",
    color: "#667085",
    lineHeight: 21,
    marginVertical: 9,
  },
  button: {
    backgroundColor: "#4169E1",
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
    marginTop: 12,
    minWidth: 160,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  error: {
    color: "#B42318",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 10,
  },
});
