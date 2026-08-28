import { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { useAuthStore } from "../../src/auth/auth.store";
import { getCustomerBookings, type Booking } from "../../src/api/bookings";

export default function CustomerHome() {
  const user = useAuthStore((state) => state.user);
  const firstName = user?.firstName?.trim() || "Customer";

  const bookingsQuery = useQuery({
    queryKey: ["customer-bookings", user?.id],
    queryFn: () => getCustomerBookings(user!.id),
    enabled: Boolean(user?.id),
  });

  const bookings = bookingsQuery.data ?? [];

  const activeBooking = useMemo<Booking | null>(() => {
    const activeStatuses = new Set([
      "REQUESTED",
      "SEARCHING",
      "ASSIGNED",
      "ACCEPTED",
      "DRIVER_ARRIVING",
      "ARRIVED",
      "IN_TRANSIT",
      "DISPUTED",
    ]);

    return (
      bookings.find((booking) => activeStatuses.has(booking.status)) ?? null
    );
  }, [bookings]);

  const trip = activeBooking ?? bookings[0] ?? null;

  const handleTripPress = () => {
    if (trip?.id) {
      router.push(`/(customer)/bookings/${trip.id}`);
      return;
    }

    router.push("/(customer)/bookings");
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            style={styles.notificationButton}
            onPress={() => {
              // Notifications route does not currently exist.
              // The icon remains visible as specified by the approved layout.
            }}
          >
            <Text style={styles.notificationIcon}>🔔</Text>
          </Pressable>

          <Text style={styles.brand}>TRANSCONET</Text>

          <Text style={styles.greeting}>
            Hello, {firstName} 👋
          </Text>
        </View>

        {/* ADVERT CARD */}
        <View style={styles.adCard}>
          <Text style={styles.adTitle}>ADVERT CARD</Text>
          <Text style={styles.adText}>
            Admin-controlled advert
          </Text>
        </View>

        {/* CUSTOMER SERVICES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            What would you like to do?
          </Text>

          <View style={styles.serviceRow}>
            <Link href="/(customer)/bookings/create" asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Book Transport"
                style={styles.serviceCard}
              >
                <Text style={styles.serviceIcon}>🚚</Text>
                <Text style={styles.serviceTitle}>
                  Book Transport
                </Text>
              </Pressable>
            </Link>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Logistics"
              style={styles.serviceCard}
              onPress={() => {
                // No dedicated logistics route currently exists.
                // Keep the approved UI without inventing a route.
              }}
            >
              <Text style={styles.serviceIcon}>📦</Text>
              <Text style={styles.serviceTitle}>
                Logistics
              </Text>
            </Pressable>
          </View>
        </View>

        {/* MY TRIP */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MY TRIP</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              trip
                ? "View active or recent booking"
                : "View bookings"
            }
            style={styles.tripCard}
            onPress={handleTripPress}
          >
            <View style={styles.tripInfo}>
              <Text style={styles.tripTitle}>
                {trip
                  ? "Active / Recent Booking"
                  : "No active / recent booking"}
              </Text>

              <Text style={styles.tripStatus}>
                {trip
                  ? trip.status.replaceAll("_", " ")
                  : "No booking yet"}
              </Text>
            </View>

            <Text style={styles.viewArrow}>View →</Text>
          </Pressable>
        </View>

        {/* TRACK YOUR TRIP */}
        <View style={styles.section}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Track Your Trip"
            style={styles.trackCard}
            onPress={handleTripPress}
          >
            <Text style={styles.trackIcon}>📍</Text>

            <Text style={styles.trackTitle}>
              Track Your Trip
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* APPROVED BOTTOM NAVIGATION */}
      <View style={styles.bottomNav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Home"
          style={styles.navItem}
          onPress={() => router.replace("/(customer)")}
        >
          <Text style={styles.navIcon}>⌂</Text>
          <Text style={styles.navActive}>Home</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bookings"
          style={styles.navItem}
          onPress={() => router.push("/(customer)/bookings")}
        >
          <Text style={styles.navIcon}>▣</Text>
          <Text style={styles.navText}>Bookings</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Account"
          style={styles.navItem}
          onPress={() => {
            // Account route does not currently exist.
          }}
        >
          <Text style={styles.navIcon}>◉</Text>
          <Text style={styles.navText}>Account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F9FC",
  },

  container: {
    padding: 20,
    paddingBottom: 110,
    gap: 20,
  },

  header: {
    alignItems: "center",
    paddingTop: 8,
  },

  notificationButton: {
    alignSelf: "flex-start",
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  notificationIcon: {
    fontSize: 22,
  },

  brand: {
    marginTop: -4,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 2,
    color: "#111827",
  },

  greeting: {
    marginTop: 14,
    alignSelf: "stretch",
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },

  adCard: {
    minHeight: 150,
    borderRadius: 20,
    backgroundColor: "#0B63CE",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  adTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1,
  },

  adText: {
    marginTop: 10,
    fontSize: 15,
    color: "#FFFFFF",
  },

  section: {
    gap: 12,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "#667085",
  },

  serviceRow: {
    flexDirection: "row",
    gap: 12,
  },

  serviceCard: {
    flex: 1,
    minHeight: 112,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    padding: 16,
    justifyContent: "space-between",
  },

  serviceIcon: {
    fontSize: 28,
  },

  serviceTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },

  tripCard: {
    minHeight: 82,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  tripInfo: {
    flex: 1,
    paddingRight: 12,
  },

  tripTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },

  tripStatus: {
    marginTop: 7,
    fontSize: 13,
    color: "#667085",
    textTransform: "capitalize",
  },

  viewArrow: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0B63CE",
  },

  trackCard: {
    minHeight: 64,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  trackIcon: {
    fontSize: 21,
  },

  trackTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },

  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 76,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E4E7EC",
    flexDirection: "row",
    justifyContent: "space-around",
  },

  navItem: {
    minWidth: 80,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },

  navIcon: {
    fontSize: 20,
    color: "#667085",
  },

  navText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#667085",
  },

  navActive: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0B63CE",
  },
});
