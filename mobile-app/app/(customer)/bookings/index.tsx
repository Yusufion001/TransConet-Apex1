import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
      <Text style={styles.title}>Your Shipments</Text>
      <Text style={styles.subtitle}>
        Track requests, active transport, and completed deliveries.
      </Text>

      {bookings.length === 0 ? (
        <View style={styles.empty}>
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
                  <Text style={styles.status}>{booking.status}</Text>
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

              <Text style={styles.location}>{booking.pickupLocation}</Text>
              <Text style={styles.arrow}>↓</Text>
              <Text style={styles.location}>{booking.destination}</Text>

              <Text style={styles.date}>
                {new Date(booking.createdAt).toLocaleDateString()}
              </Text>
            </Pressable>
          </Link>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: "#F7F9FC" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: { fontSize: 30, fontWeight: "800", color: "#111827", marginTop: 24 },
  subtitle: { fontSize: 15, color: "#667085", marginTop: 8, marginBottom: 24 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EAECF0",
  },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },
  negotiatedBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
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
  status: { fontSize: 12, fontWeight: "800", color: "#175CD3" },
  id: { fontSize: 12, color: "#98A2B3" },
  location: { fontSize: 16, fontWeight: "700", color: "#1D2939" },
  arrow: { fontSize: 18, color: "#98A2B3", marginVertical: 5 },
  date: { marginTop: 14, fontSize: 12, color: "#667085" },
  empty: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    marginTop: 10,
  },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: "#111827" },
  emptyText: {
    textAlign: "center",
    color: "#667085",
    lineHeight: 21,
    marginVertical: 10,
  },
  button: {
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
    marginTop: 12,
  },
  buttonText: { color: "#FFFFFF", fontWeight: "800" },
  error: { color: "#B42318", fontSize: 16, marginBottom: 10 },
});
