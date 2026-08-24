import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getBooking } from "../../../src/api/bookings";
import { joinBookingRealtime, type BookingRealtimeEvent, type VehicleLocation } from "../../../src/realtime/booking-realtime";

export default function BookingDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [vehicleLocation, setVehicleLocation] = useState<VehicleLocation | null>(null);

  const query = useQuery({
    queryKey: ["booking", id],
    queryFn: () => getBooking(id),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (!id) return;

    let cleanup: (() => void) | undefined;

    void joinBookingRealtime(id, {
      onBookingActivity: (event: BookingRealtimeEvent) => {
        setLiveStatus(event.eventType);
        void query.refetch();
      },
      onVehicleLocation: setVehicleLocation,
      onAccessDenied: (message) => Alert.alert("Realtime access", message),
    }).then((unsubscribe) => {
      cleanup = unsubscribe;
    }).catch(() => {
      // REST booking data remains available if realtime is unavailable.
    });

    return () => cleanup?.();
  }, [id, query.refetch]);

  if (query.isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  if (!query.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Shipment not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.button}>
          <Text style={styles.buttonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const booking = query.data;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>

      <Text style={styles.title}>Shipment Details</Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>CURRENT STATUS</Text>
        <Text style={styles.status}>{booking.status}</Text>
        {liveStatus && <Text style={styles.live}>Live update: {liveStatus}</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>PICKUP</Text>
        <Text style={styles.value}>{booking.pickupLocation}</Text>

        <Text style={styles.arrow}>↓</Text>

        <Text style={styles.label}>DESTINATION</Text>
        <Text style={styles.value}>{booking.destination}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>SHIPMENT</Text>
        <Text style={styles.detail}>Truck: {booking.truckCategory}</Text>
        <Text style={styles.detail}>Weight: {booking.cargoWeight ?? "—"}</Text>
        <Text style={styles.detail}>
          Fare: {booking.fare ?? booking.estimatedFare ?? "Pending"}
        </Text>
        <Text style={styles.detail}>Payment: {booking.paymentStatus}</Text>
      </View>

      {vehicleLocation && (
        <View style={styles.liveCard}>
          <Text style={styles.label}>LIVE VEHICLE LOCATION</Text>
          <Text style={styles.detail}>Latitude: {vehicleLocation.latitude.toFixed(6)}</Text>
          <Text style={styles.detail}>Longitude: {vehicleLocation.longitude.toFixed(6)}</Text>
          {vehicleLocation.speed != null && (
            <Text style={styles.detail}>Speed: {vehicleLocation.speed}</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: "#F7F9FC" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  back: { color: "#175CD3", fontSize: 16, fontWeight: "700", marginTop: 20 },
  title: { fontSize: 30, fontWeight: "800", color: "#111827", marginVertical: 22 },
  statusCard: {
    backgroundColor: "#111827",
    borderRadius: 20,
    padding: 22,
    marginBottom: 16,
  },
  statusLabel: { color: "#98A2B3", fontSize: 11, fontWeight: "800" },
  status: { color: "#FFFFFF", fontSize: 24, fontWeight: "800", marginTop: 7 },
  live: { color: "#A4F4C5", marginTop: 10, fontSize: 13 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#EAECF0",
  },
  liveCard: {
    backgroundColor: "#EEF6FF",
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
  },
  label: { color: "#667085", fontSize: 11, fontWeight: "800", marginBottom: 7 },
  value: { color: "#1D2939", fontSize: 17, fontWeight: "700" },
  arrow: { color: "#98A2B3", fontSize: 20, marginVertical: 8 },
  detail: { color: "#475467", fontSize: 15, marginTop: 8 },
  error: { color: "#B42318", fontSize: 16 },
  button: {
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
    marginTop: 14,
  },
  buttonText: { color: "#FFFFFF", fontWeight: "800" },
});
