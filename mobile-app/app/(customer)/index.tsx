import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Linking,
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
import { getAdvertisements } from "../../src/api/marketing";

export default function CustomerHome() {
  const user = useAuthStore((state) => state.user);
  const firstName = user?.firstName?.trim() || "Customer";

  const bookingsQuery = useQuery({
    queryKey: ["customer-bookings", user?.id],
    queryFn: () => getCustomerBookings(user!.id),
    enabled: Boolean(user?.id),
  });

  const bookings = bookingsQuery.data ?? [];

  const advertisementsQuery = useQuery({
    queryKey: ["customer-home-advertisements"],
    queryFn: () => getAdvertisements("MOBILE_HOME"),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnMount: true,
  });

  const advertisements = advertisementsQuery.data ?? [];
  const [advertisementIndex, setAdvertisementIndex] = useState(0);

  useEffect(() => {
    if (advertisements.length <= 1) return;

    const timer = setInterval(() => {
      setAdvertisementIndex(
        (current) => (current + 1) % advertisements.length,
      );
    }, 8000);

    return () => clearInterval(timer);
  }, [advertisements.length]);

  useEffect(() => {
    if (advertisementIndex >= advertisements.length) {
      setAdvertisementIndex(0);
    }
  }, [advertisements.length, advertisementIndex]);

  const advertisement = advertisements[advertisementIndex] ?? null;

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
            onPress={() => router.push("/(customer)/notifications")}
          >
            <Text style={styles.notificationIcon}>🔔</Text>
          </Pressable>

          <Text style={styles.brand}>TRANSCONET</Text>

          <Text style={styles.greeting}>
            Hello, {firstName} 👋
          </Text>
        </View>

        {/* ADMIN-CONTROLLED ADVERTISEMENT */}
        {advertisement ? (
          <View style={styles.adCard}>
            {advertisement.imageUrl ? (
              <Image
                source={{ uri: advertisement.imageUrl }}
                style={styles.adImage}
                resizeMode="cover"
                accessibilityLabel={advertisement.title}
              />
            ) : null}

            <View style={styles.adContent}>
              <Text style={styles.adTitle}>
                {advertisement.title}
              </Text>

              {advertisement.description ? (
                <Text style={styles.adText}>
                  {advertisement.description}
                </Text>
              ) : null}

              {advertisement.ctaLabel && advertisement.ctaUrl ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={advertisement.ctaLabel}
                  onPress={() => {
                    void Linking.openURL(advertisement.ctaUrl!);
                  }}
                  style={styles.adButton}
                >
                  <Text style={styles.adButtonText}>
                    {advertisement.ctaLabel}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {advertisements.length > 1 ? (
              <View style={styles.adIndicators}>
                {advertisements.map((item, index) => (
                  <View
                    key={item.id}
                    style={[
                      styles.adIndicator,
                      index === advertisementIndex &&
                        styles.adIndicatorActive,
                    ]}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

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
              onPress={() =>
                router.push("/(customer)/bookings/create")
              }
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
          onPress={() => router.push("/(customer)/account")}
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
    overflow: "hidden",
  },

  adImage: {
    width: "100%",
    height: 170,
  },

  adContent: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  adIndicators: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingBottom: 12,
  },

  adIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.45)",
  },

  adIndicatorActive: {
    width: 18,
    backgroundColor: "#FFFFFF",
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

  adButton: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },

  adButtonText: {
    color: "#0B63CE",
    fontSize: 13,
    fontWeight: "800",
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
