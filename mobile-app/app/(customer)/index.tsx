import { useEffect, useMemo, useState } from "react";
import { getUserNotifications } from "../../src/api/notifications";
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, router, useNavigation } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { useAuthStore } from "../../src/auth/auth.store";
import { getCustomerBookings, type Booking } from "../../src/api/bookings";
import { getAdvertisements } from "../../src/api/marketing";

export default function CustomerHome() {
  const user = useAuthStore((state) => state.user);
  const navigation = useNavigation<any>();
  const firstName = user?.firstName?.trim() || "Customer";

  const bookingsQuery = useQuery({
    queryKey: ["customer-bookings", user?.id],
    queryFn: () => getCustomerBookings(user!.id),
    enabled: Boolean(user?.id),
  });

  const bookings = bookingsQuery.data ?? [];

  const notificationsQuery = useQuery({
    queryKey: ["customer-notifications", user?.id],
    queryFn: () => getUserNotifications(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnMount: true,
  });

  const unreadNotificationCount =
    notificationsQuery.data?.filter((notification) => !notification.read)
      .length ?? 0;


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
    if (trip?.expressBookingId) {
      router.push(`/(customer)/express/${trip.expressBookingId}`);
      return;
    }

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
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open navigation menu"
              style={styles.menuButton}
              onPress={() => navigation.openDrawer()}
            >
              <Ionicons name="menu-outline" size={25} color="#101B3A" />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                unreadNotificationCount > 0
                  ? `Notifications, ${unreadNotificationCount} unread`
                  : "Notifications"
              }
              style={styles.notificationButton}
              onPress={() => router.push("/(customer)/notifications")}
            >
              <Ionicons name="notifications-outline" size={23} color="#101B3A" />
              {unreadNotificationCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadNotificationCount > 99
                      ? "99+"
                      : unreadNotificationCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          <Text style={styles.brand}>TRANSCONET</Text>

          <View style={styles.greetingBlock}>
            <Text style={styles.greetingEyebrow}>CUSTOMER COMMAND CENTER</Text>
            <Text style={styles.greeting}>Hello, {firstName}</Text>
            <Text style={styles.greetingSubtitle}>
              Manage your shipments and move your cargo with confidence.
            </Text>
          </View>
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Marketplace booking"
              style={styles.serviceCard}
              onPress={() => router.push("/(customer)/bookings/create")}
            >
              <View style={[styles.serviceIconWrap, styles.marketplaceIconWrap]}>
                <Ionicons name="cube-outline" size={25} color="#4169E1" />
              </View>
              <Text style={styles.serviceTitle}>
                Marketplace
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Express booking"
              style={styles.serviceCard}
              onPress={() => router.push("/(customer)/express")}
            >
              <View style={[styles.serviceIconWrap, styles.expressIconWrap]}>
                <Ionicons name="flash-outline" size={25} color="#FFFFFF" />
              </View>
              <Text style={styles.serviceTitle}>
                Express Booking
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

            <View style={styles.viewAction}>
              <Text style={styles.viewArrow}>View</Text>
              <Ionicons name="arrow-forward" size={16} color="#4169E1" />
            </View>
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
            <View style={styles.trackIconWrap}>
              <Ionicons name="navigate-outline" size={22} color="#FFFFFF" />
            </View>

            <View style={styles.trackCopy}>
              <Text style={styles.trackEyebrow}>LIVE JOURNEY</Text>
              <Text style={styles.trackTitle}>Track Your Trip</Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color="#FFFFFF" />
          </Pressable>
        </View>
      </ScrollView>


    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F4F7FF",
  },

  container: {
    padding: 20,
    paddingTop: 14,
    paddingBottom: 34,
    gap: 20,
  },

  header: {
    paddingTop: 2,
  },

  headerActions: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  menuButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAF7",
  },

  notificationButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAF7",
  },

  notificationBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: "#D92D20",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  notificationBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    lineHeight: 12,
  },

  brand: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1.8,
    color: "#4169E1",
  },

  greetingBlock: {
    marginTop: 12,
  },

  greetingEyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.35,
    color: "#667085",
  },

  greeting: {
    marginTop: 5,
    fontSize: 29,
    lineHeight: 36,
    fontWeight: "900",
    color: "#101B3A",
  },

  greetingSubtitle: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 20,
    color: "#667085",
    maxWidth: 330,
  },

  adCard: {
    minHeight: 150,
    borderRadius: 22,
    backgroundColor: "#4169E1",
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
    letterSpacing: 0.2,
    textAlign: "center",
  },

  adText: {
    marginTop: 9,
    fontSize: 14,
    lineHeight: 20,
    color: "#FFFFFF",
    textAlign: "center",
  },

  adButton: {
    marginTop: 14,
    minHeight: 42,
    paddingHorizontal: 17,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  adButtonText: {
    color: "#4169E1",
    fontSize: 13,
    fontWeight: "900",
  },

  section: {
    gap: 11,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#101B3A",
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.25,
    color: "#667085",
  },

  serviceRow: {
    flexDirection: "row",
    gap: 12,
  },

  serviceCard: {
    flex: 1,
    minHeight: 136,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E8F5",
    padding: 16,
    justifyContent: "space-between",
    shadowColor: "#101B3A",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  serviceIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },

  marketplaceIconWrap: {
    backgroundColor: "#EEF3FF",
  },

  expressIconWrap: {
    backgroundColor: "#101B3A",
  },

  serviceTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    color: "#101B3A",
  },

  tripCard: {
    minHeight: 92,
    borderRadius: 19,
    backgroundColor: "#101B3A",
    padding: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#101B3A",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  tripInfo: {
    flex: 1,
    paddingRight: 12,
  },

  tripTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  tripStatus: {
    marginTop: 7,
    fontSize: 12,
    fontWeight: "700",
    color: "#C9D4F2",
    textTransform: "capitalize",
  },

  viewAction: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  viewArrow: {
    fontSize: 13,
    fontWeight: "900",
    color: "#4169E1",
  },

  trackCard: {
    minHeight: 76,
    borderRadius: 19,
    backgroundColor: "#4169E1",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#4169E1",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  trackIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  trackCopy: {
    flex: 1,
  },

  trackEyebrow: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#DDE6FF",
  },

  trackTitle: {
    marginTop: 3,
    fontSize: 16,
    fontWeight: "900",
    color: "#FFFFFF",
  },
});
