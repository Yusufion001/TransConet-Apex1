import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import MapView, { Marker, Polyline } from "react-native-maps";

import { useAuthStore } from "../../src/auth/auth.store";
import {
  getCustomerBookings,
  type Booking,
} from "../../src/api/bookings";
import {
  joinBookingRealtime,
  type VehicleLocation,
} from "../../src/realtime/booking-realtime";

export default function CustomerHome() {
  const [menuOpen, setMenuOpen] = useState(false);
  const user = useAuthStore((state) => state.user);

  const [vehicleLocation, setVehicleLocation] =
    useState<VehicleLocation | null>(null);

  const bookingsQuery = useQuery({
    queryKey: ["customer-bookings", user?.id],
    queryFn: () => getCustomerBookings(user!.id),
    enabled: Boolean(user?.id),
  });

  const bookings = bookingsQuery.data ?? [];

  const activeBooking = useMemo<Booking | null>(() => {
    const activeStatuses = new Set([
      "PENDING",
      "ACCEPTED",
      "DRIVER_ARRIVING",
      "ARRIVED",
      "IN_TRANSIT",
    ]);

    return (
      bookings.find((booking) => activeStatuses.has(booking.status)) ?? null
    );
  }, [bookings]);

  useEffect(() => {
    if (!activeBooking?.id) {
      setVehicleLocation(null);
      return;
    }

    let cleanup: (() => void) | undefined;

    void joinBookingRealtime(activeBooking.id, {
      onVehicleLocation: setVehicleLocation,
      onBookingActivity: () => {
        void bookingsQuery.refetch();
      },
    })
      .then((unsubscribe) => {
        cleanup = unsubscribe;
      })
      .catch(() => {
        // The command center remains usable through REST data.
      });

    return () => cleanup?.();
  }, [activeBooking?.id]);

  const pickupLatitude = activeBooking
    ? Number(activeBooking.pickupLatitude)
    : NaN;

  const pickupLongitude = activeBooking
    ? Number(activeBooking.pickupLongitude)
    : NaN;

  const destinationLatitude = activeBooking
    ? Number(activeBooking.destinationLatitude)
    : NaN;

  const destinationLongitude = activeBooking
    ? Number(activeBooking.destinationLongitude)
    : NaN;

  const hasRoute =
    Number.isFinite(pickupLatitude) &&
    Number.isFinite(pickupLongitude) &&
    Number.isFinite(destinationLatitude) &&
    Number.isFinite(destinationLongitude);

  const mapCenter = vehicleLocation
    ? {
        latitude: vehicleLocation.latitude,
        longitude: vehicleLocation.longitude,
        latitudeDelta: 0.25,
        longitudeDelta: 0.25,
      }
    : hasRoute
      ? {
          latitude: (pickupLatitude + destinationLatitude) / 2,
          longitude: (pickupLongitude + destinationLongitude) / 2,
          latitudeDelta: Math.max(
            Math.abs(destinationLatitude - pickupLatitude) * 2,
            0.12,
          ),
          longitudeDelta: Math.max(
            Math.abs(destinationLongitude - pickupLongitude) * 2,
            0.12,
          ),
        }
      : {
          latitude: 6.5244,
          longitude: 3.3792,
          latitudeDelta: 0.35,
          longitudeDelta: 0.35,
        };

  const firstName = user?.firstName?.trim() || "Customer";

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>TRANSCONET</Text>
          <Text style={styles.greeting}>Good morning, {firstName}</Text>
          <Text style={styles.tagline}>Your logistics, connected.</Text>
        </View>

        <Pressable
          accessibilityLabel="Open menu"
          onPress={() => setMenuOpen(true)}
          style={styles.menuButton}
        >
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
        </Pressable>
      </View>

      {menuOpen && (
        <View style={styles.menuOverlay}>
          <Pressable
            style={styles.menuBackdrop}
            onPress={() => setMenuOpen(false)}
          />

          <View style={styles.menuPanel}>
            <View style={styles.menuHeader}>
              <View>
                <Text style={styles.menuBrand}>TRANSCONET</Text>
                <Text style={styles.menuSubtitle}>Logistics command</Text>
              </View>

              <Pressable
                accessibilityLabel="Close menu"
                onPress={() => setMenuOpen(false)}
                style={styles.menuClose}
              >
                <Text style={styles.menuCloseText}>×</Text>
              </Pressable>
            </View>

            <View style={styles.menuRule} />

            <Pressable
              style={styles.menuItem}
              onPress={() => setMenuOpen(false)}
            >
              <Text style={styles.menuItemIndex}>01</Text>
              <View>
                <Text style={styles.menuItemTitle}>Operations</Text>
                <Text style={styles.menuItemText}>
                  Your logistics command center
                </Text>
              </View>
            </Pressable>

            <Link href="/(customer)/bookings/create" asChild>
              <Pressable
                style={styles.menuItem}
                onPress={() => setMenuOpen(false)}
              >
                <Text style={styles.menuItemIndex}>02</Text>
                <View>
                  <Text style={styles.menuItemTitle}>Book Transport</Text>
                  <Text style={styles.menuItemText}>
                    Start a new shipment
                  </Text>
                </View>
              </Pressable>
            </Link>

            <Link href="/(customer)/bookings" asChild>
              <Pressable
                style={styles.menuItem}
                onPress={() => setMenuOpen(false)}
              >
                <Text style={styles.menuItemIndex}>03</Text>
                <View>
                  <Text style={styles.menuItemTitle}>My Shipments</Text>
                  <Text style={styles.menuItemText}>
                    Review movement and delivery
                  </Text>
                </View>
              </Pressable>
            </Link>

            <Pressable
              style={styles.menuItem}
              onPress={() => setMenuOpen(false)}
            >
              <Text style={styles.menuItemIndex}>04</Text>
              <View>
                <Text style={styles.menuItemTitle}>Marketplace</Text>
                <Text style={styles.menuItemText}>
                  Discover transport capacity
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.menuItem}
              onPress={() => setMenuOpen(false)}
            >
              <Text style={styles.menuItemIndex}>05</Text>
              <View>
                <Text style={styles.menuItemTitle}>Support</Text>
                <Text style={styles.menuItemText}>
                  Help with your logistics
                </Text>
              </View>
            </Pressable>

            <View style={styles.menuFooter}>
              <Text style={styles.menuFooterBrand}>TRANSCONET</Text>
              <Text style={styles.menuFooterText}>
                Connected logistics. Built for movement.
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.adCard}>
        <View style={styles.adBadge}>
          <Text style={styles.adBadgeText}>TRANSCONET FEATURE</Text>
        </View>

        <Text style={styles.adTitle}>Move with confidence.</Text>

        <Text style={styles.adText}>
          Connected transport intelligence for shipments that keep moving.
        </Text>

        <Pressable style={styles.exploreButton}>
          <Text style={styles.exploreText}>Explore</Text>
          <Text style={styles.exploreArrow}>→</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>OPERATIONS</Text>
          <Text style={styles.sectionTitle}>Active operations</Text>
        </View>

        {activeBooking && (
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </View>

      {bookingsQuery.isLoading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>
            Connecting to your operations...
          </Text>
        </View>
      ) : activeBooking ? (
        <View style={styles.operationCard}>
          <View style={styles.mapFrame}>
            <MapView
              style={styles.map}
              initialRegion={mapCenter}
              region={vehicleLocation ? mapCenter : undefined}
            >
              {hasRoute && (
                <>
                  <Marker
                    coordinate={{
                      latitude: pickupLatitude,
                      longitude: pickupLongitude,
                    }}
                    title="Pickup"
                    description={activeBooking.pickupLocation}
                  />

                  <Marker
                    coordinate={{
                      latitude: destinationLatitude,
                      longitude: destinationLongitude,
                    }}
                    title="Destination"
                    description={activeBooking.destination}
                  />

                  <Polyline
                    coordinates={[
                      {
                        latitude: pickupLatitude,
                        longitude: pickupLongitude,
                      },
                      ...(vehicleLocation
                        ? [
                            {
                              latitude: vehicleLocation.latitude,
                              longitude: vehicleLocation.longitude,
                            },
                          ]
                        : []),
                      {
                        latitude: destinationLatitude,
                        longitude: destinationLongitude,
                      },
                    ]}
                    strokeWidth={4}
                  />
                </>
              )}

              {vehicleLocation && (
                <Marker
                  coordinate={{
                    latitude: vehicleLocation.latitude,
                    longitude: vehicleLocation.longitude,
                  }}
                  title="TransConet vehicle"
                  description="Live vehicle position"
                >
                  <View style={styles.vehicleMarker}>
                    <Text style={styles.vehicleMarkerText}>TC</Text>
                  </View>
                </Marker>
              )}
            </MapView>

            {!hasRoute && (
              <View style={styles.mapNotice}>
                <Text style={styles.mapNoticeTitle}>
                  Location awaiting confirmation
                </Text>
                <Text style={styles.mapNoticeText}>
                  Shipment coordinates will appear here when available.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.operationInfo}>
            <View style={styles.operationTop}>
              <Text style={styles.shipmentId}>
                Shipment #{activeBooking.id.slice(0, 8).toUpperCase()}
              </Text>
              <Text style={styles.operationStatus}>
                {activeBooking.status.replaceAll("_", " ")}
              </Text>
            </View>

            <Text style={styles.route}>
              {activeBooking.pickupLocation}
            </Text>
            <Text style={styles.routeArrow}>↓</Text>
            <Text style={styles.route}>{activeBooking.destination}</Text>

            {vehicleLocation ? (
              <Text style={styles.movement}>
                ● Transporter location updating in real time
              </Text>
            ) : (
              <Text style={styles.waiting}>
                Transporter movement will appear here when available
              </Text>
            )}

            <Link
              href={`/(customer)/bookings/${activeBooking.id}`}
              asChild
            >
              <Pressable style={styles.viewButton}>
                <Text style={styles.viewButtonText}>View Shipment</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      ) : (
        <View style={styles.emptyOperation}>
          <Text style={styles.emptyTitle}>No active operations</Text>
          <Text style={styles.emptyText}>
            Your next shipment will appear here with its operational status
            and movement information.
          </Text>

          <Link href="/(customer)/bookings/create" asChild>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Start a Shipment</Text>
            </Pressable>
          </Link>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>SHORTCUTS</Text>
          <Text style={styles.sectionTitle}>Quick actions</Text>
        </View>
      </View>

      <View style={styles.actionsGrid}>
        <Link href="/(customer)/bookings/create" asChild>
          <Pressable style={styles.actionCard}>
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>+</Text>
            </View>
            <Text style={styles.actionTitle}>Book Transport</Text>
            <Text style={styles.actionText}>
              Create a new shipment
            </Text>
          </Pressable>
        </Link>

        <Link href="/(customer)/bookings" asChild>
          <Pressable style={styles.actionCard}>
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>≡</Text>
            </View>
            <Text style={styles.actionTitle}>My Shipments</Text>
            <Text style={styles.actionText}>
              Review your logistics activity
            </Text>
          </Pressable>
        </Link>

        <Pressable style={styles.actionCard}>
          <View style={styles.actionIcon}>
            <Text style={styles.actionIconText}>◎</Text>
          </View>
          <Text style={styles.actionTitle}>Marketplace</Text>
          <Text style={styles.actionText}>
            Discover transport capacity
          </Text>
        </Pressable>

        <Pressable style={styles.actionCard}>
          <View style={styles.actionIcon}>
            <Text style={styles.actionIconText}>?</Text>
          </View>
          <Text style={styles.actionTitle}>Support</Text>
          <Text style={styles.actionText}>
            Get help with an operation
          </Text>
        </Pressable>
      </View>

      <View style={styles.footerBrand}>
        <Text style={styles.footerBrandName}>TRANSCONET</Text>
        <Text style={styles.footerText}>
          Connected logistics. Built for movement.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 40,
    backgroundColor: "#F5F7FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  brand: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 2.2,
    color: "#0B63CE",
    marginBottom: 10,
  },
  greeting: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    color: "#101828",
  },
  tagline: {
    marginTop: 5,
    fontSize: 15,
    color: "#667085",
  },
  menuButton: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EAECF0",
  },
  menuLine: {
    width: 20,
    height: 2,
    marginVertical: 2,
    borderRadius: 2,
    backgroundColor: "#101828",
  },
  adCard: {
    backgroundColor: "#0B1F3A",
    borderRadius: 24,
    padding: 22,
    marginBottom: 30,
    overflow: "hidden",
  },
  adBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#173D6B",
    marginBottom: 18,
  },
  adBadgeText: {
    color: "#8FC5FF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  adTitle: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "800",
  },
  adText: {
    color: "#C9D8EA",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 310,
  },
  exploreButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  exploreText: {
    color: "#0B1F3A",
    fontWeight: "800",
    fontSize: 13,
  },
  exploreArrow: {
    color: "#0B63CE",
    fontWeight: "900",
    fontSize: 17,
    marginLeft: 7,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionEyebrow: {
    color: "#0B63CE",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  sectionTitle: {
    color: "#101828",
    fontSize: 21,
    fontWeight: "800",
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#ECFDF3",
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 7,
    backgroundColor: "#12B76A",
    marginRight: 6,
  },
  liveText: {
    color: "#027A48",
    fontSize: 10,
    fontWeight: "900",
  },
  loadingCard: {
    height: 230,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
  },
  loadingText: {
    marginTop: 10,
    color: "#667085",
    fontSize: 13,
  },
  operationCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EAECF0",
    marginBottom: 30,
  },
  mapFrame: {
    height: 285,
    position: "relative",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  mapNotice: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    padding: 13,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.94)",
  },
  mapNoticeTitle: {
    color: "#101828",
    fontSize: 13,
    fontWeight: "800",
  },
  mapNoticeText: {
    color: "#667085",
    fontSize: 12,
    marginTop: 3,
  },
  vehicleMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0B63CE",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleMarkerText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  operationInfo: {
    padding: 18,
  },
  operationTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  shipmentId: {
    color: "#101828",
    fontSize: 13,
    fontWeight: "800",
  },
  operationStatus: {
    color: "#0B63CE",
    fontSize: 10,
    fontWeight: "900",
  },
  route: {
    color: "#1D2939",
    fontSize: 16,
    fontWeight: "700",
  },
  routeArrow: {
    color: "#98A2B3",
    fontSize: 18,
    marginVertical: 4,
  },
  movement: {
    color: "#027A48",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 15,
  },
  waiting: {
    color: "#667085",
    fontSize: 12,
    marginTop: 15,
  },
  viewButton: {
    marginTop: 16,
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: "#0B63CE",
  },
  viewButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  emptyOperation: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 24,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: "#EAECF0",
  },
  emptyTitle: {
    color: "#101828",
    fontSize: 18,
    fontWeight: "800",
  },
  emptyText: {
    color: "#667085",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
  },
  primaryButton: {
    marginTop: 18,
    alignSelf: "flex-start",
    borderRadius: 13,
    paddingHorizontal: 18,
    paddingVertical: 13,
    backgroundColor: "#0B63CE",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  actionCard: {
    width: "48%",
    minHeight: 155,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 17,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EAECF0",
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#EAF3FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },
  actionIconText: {
    color: "#0B63CE",
    fontSize: 21,
    fontWeight: "800",
  },
  actionTitle: {
    color: "#101828",
    fontSize: 14,
    fontWeight: "800",
  },
  actionText: {
    color: "#667085",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  menuOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    flexDirection: "row",
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(7, 18, 32, 0.52)",
  },
  menuPanel: {
    width: "86%",
    height: "100%",
    marginLeft: "14%",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 22,
    paddingTop: 58,
    paddingBottom: 30,
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 28,
  },
  menuHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  menuBrand: {
    color: "#0B63CE",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 2.2,
  },
  menuSubtitle: {
    color: "#667085",
    fontSize: 12,
    marginTop: 5,
  },
  menuClose: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  menuCloseText: {
    color: "#101828",
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "300",
  },
  menuRule: {
    height: 1,
    backgroundColor: "#EAECF0",
    marginVertical: 24,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F4F7",
  },
  menuItemIndex: {
    width: 36,
    color: "#98A2B3",
    fontSize: 11,
    fontWeight: "800",
  },
  menuItemTitle: {
    color: "#101828",
    fontSize: 16,
    fontWeight: "800",
  },
  menuItemText: {
    color: "#667085",
    fontSize: 11,
    marginTop: 4,
  },
  menuFooter: {
    marginTop: "auto",
    paddingTop: 24,
  },
  menuFooterBrand: {
    color: "#0B63CE",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.8,
  },
  menuFooterText: {
    color: "#98A2B3",
    fontSize: 11,
    marginTop: 5,
  },
  footerBrand: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 10,
  },
  footerBrandName: {
    color: "#0B63CE",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
  },
  footerText: {
    color: "#98A2B3",
    fontSize: 11,
    marginTop: 5,
  },
});
