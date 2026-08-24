import { useState } from "react";
import { router } from "expo-router";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { createBooking } from "../../../src/api/bookings";

export default function CreateBooking() {
  const [pickupLocation, setPickupLocation] = useState("");
  const [destination, setDestination] = useState("");
  const [cargoDescription, setCargoDescription] = useState("");
  const [cargoWeight, setCargoWeight] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!pickupLocation.trim() || !destination.trim() || !cargoWeight.trim()) {
      Alert.alert("Missing information", "Please enter pickup, destination, and cargo weight.");
      return;
    }

    setLoading(true);

    try {
      const booking = await createBooking({
        pickupLocation: pickupLocation.trim(),
        destination: destination.trim(),
        pickupLatitude: 0,
        pickupLongitude: 0,
        destinationLatitude: 0,
        destinationLongitude: 0,
        cargoDescription: cargoDescription.trim() || undefined,
        truckCategory: "LIGHT_TRUCK",
        cargoWeight: Number(cargoWeight),
      });

      router.replace(`/(customer)/bookings/${booking.id}`);
    } catch (error) {
      Alert.alert(
        "Unable to create shipment",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Book Transport</Text>
      <Text style={styles.subtitle}>
        Tell us what you need moved and where it needs to go.
      </Text>

      <Text style={styles.label}>Pickup location</Text>
      <TextInput
        value={pickupLocation}
        onChangeText={setPickupLocation}
        placeholder="Where should we collect it?"
        style={styles.input}
      />

      <Text style={styles.label}>Destination</Text>
      <TextInput
        value={destination}
        onChangeText={setDestination}
        placeholder="Where should we deliver it?"
        style={styles.input}
      />

      <Text style={styles.label}>Cargo weight</Text>
      <TextInput
        value={cargoWeight}
        onChangeText={setCargoWeight}
        placeholder="Weight in kg"
        keyboardType="decimal-pad"
        style={styles.input}
      />

      <Text style={styles.label}>Cargo description</Text>
      <TextInput
        value={cargoDescription}
        onChangeText={setCargoDescription}
        placeholder="Describe your shipment"
        multiline
        style={[styles.input, styles.textArea]}
      />

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Transport matching</Text>
        <Text style={styles.noticeText}>
          TransConet will use the shipment requirements to connect your request
          with suitable transport capacity.
        </Text>
      </View>

      <Pressable
        disabled={loading}
        onPress={submit}
        style={[styles.button, loading && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>
          {loading ? "Creating shipment..." : "Create Shipment"}
        </Text>
      </Pressable>

      <Pressable onPress={() => router.back()} style={styles.cancel}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: "#F7F9FC",
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#111827",
    marginTop: 24,
  },
  subtitle: {
    fontSize: 15,
    color: "#667085",
    marginTop: 8,
    marginBottom: 28,
    lineHeight: 22,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#344054",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 18,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  notice: {
    backgroundColor: "#EEF6FF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#175CD3",
    marginBottom: 6,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#344054",
  },
  button: {
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  cancel: {
    alignItems: "center",
    paddingVertical: 18,
  },
  cancelText: {
    color: "#475467",
    fontSize: 15,
    fontWeight: "700",
  },
});
