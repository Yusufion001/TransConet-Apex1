import { useState } from "react";
import { router } from "expo-router";
import * as Location from "expo-location";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  createBooking,
  estimateBookingFare,
  type TruckCategory,
} from "../../../src/api/bookings";

const TRUCK_CATEGORIES: TruckCategory[] = [
  "MINI_TRUCK",
  "LIGHT_TRUCK",
  "MEDIUM_TRUCK",
  "HEAVY_TRUCK",
  "CONTAINER_TRUCK",
  "REFRIGERATED_TRUCK",
  "TANKER",
  "SPECIALIZED",
];

function formatTruckCategory(value: TruckCategory) {
  return value.replace(/_/g, " ");
}

const VEHICLE_CLASS_SPEC: Record<
  TruckCategory,
  {
    capacityRange: string;
    profiles: string;
    capacityNote?: string;
  }
> = {
  MINI_TRUCK: {
    capacityRange: "500–1,500 kg",
    profiles:
      "Last-mile delivery, small parcels, retail distribution (e.g. Suzuki mini-vans, light pickups)",
  },
  LIGHT_TRUCK: {
    capacityRange: "1,500–4,000 kg",
    profiles:
      "Urban FMCG distribution, light construction materials, furniture (e.g. Mitsubishi Canter, Toyota Dyna)",
  },
  MEDIUM_TRUCK: {
    capacityRange: "4,000–15,000 kg",
    profiles:
      "Regional inter-state haulage, mid-sized agricultural yields, commercial electronics",
  },
  HEAVY_TRUCK: {
    capacityRange: "15,000–30,000 kg",
    profiles:
      "Long-haul bulk freight, heavy industrial goods, large-scale agricultural transport",
  },
  CONTAINER_TRUCK: {
    capacityRange: "20,000–35,000 kg",
    profiles:
      "Port clearance and imported goods, standard 20ft/40ft shipping containers",
  },
  REFRIGERATED_TRUCK: {
    capacityRange: "1,500–25,000 kg",
    profiles:
      "Highly variable by chassis; temperature-sensitive perishables or pharmaceuticals",
  },
  TANKER: {
    capacityRange: "10,000–45,000 kg",
    capacityNote:
      "Approximately 10,000–45,000 liters depending on tanker configuration",
    profiles:
      "Liquid bulk: petroleum products, vegetable oils, chemicals",
  },
  SPECIALIZED: {
    capacityRange: "30,000–100,000+ kg",
    profiles:
      "Lowbeds/multi-axle trailers, oversized cargo, industrial plants/heavy construction equipment",
  },
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

export default function CreateBooking() {
  const [pickupLocation, setPickupLocation] = useState("");
  const [destination, setDestination] = useState("");
  const [cargoDescription, setCargoDescription] = useState("");
  const [cargoWeight, setCargoWeight] = useState("");
  const [truckCategory, setTruckCategory] =
    useState<TruckCategory | null>(null);
  const [pickupCoordinates, setPickupCoordinates] =
    useState<Coordinates | null>(null);
  const [loading, setLoading] = useState(false);
  const [fareEstimate, setFareEstimate] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<
    "FLUTTERWAVE" | "BANK_TRANSFER" | "NEGOTIATE" | null
  >(null);
  const [locationLoading, setLocationLoading] = useState(false);

  async function useCurrentLocation() {
    setLocationLoading(true);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert(
          "Location permission required",
          "Please allow TransConet to access your location so your pickup point can be identified.",
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setPickupCoordinates(coordinates);

      try {
        const addresses = await Location.reverseGeocodeAsync(coordinates);
        const address = addresses[0];

        if (address) {
          const parts = [
            address.name,
            address.street,
            address.city,
            address.region,
          ].filter(Boolean);

          if (parts.length > 0) {
            setPickupLocation(parts.join(", "));
          }
        }
      } catch {
        // Coordinates are still valid even if reverse geocoding fails.
      }
    } catch (error) {
      Alert.alert(
        "Unable to get location",
        error instanceof Error
          ? error.message
          : "Please enter your pickup location manually.",
      );
    } finally {
      setLocationLoading(false);
    }
  }

  async function resolveAddress(
    address: string,
  ): Promise<Coordinates | null> {
    const results = await Location.geocodeAsync(address);

    if (!results.length) {
      return null;
    }

    const result = results[0];

    if (
      !Number.isFinite(result.latitude) ||
      !Number.isFinite(result.longitude)
    ) {
      return null;
    }

    return {
      latitude: result.latitude,
      longitude: result.longitude,
    };
  }

  async function submit() {
    if (
      !pickupLocation.trim() ||
      !destination.trim() ||
      !cargoWeight.trim() ||
      !truckCategory
    ) {
      Alert.alert(
        "Missing information",
        "Please enter pickup, destination, vehicle class, and cargo weight.",
      );
      return;
    }

    const numericWeight = Number(cargoWeight);

    if (!Number.isFinite(numericWeight) || numericWeight <= 0) {
      Alert.alert(
        "Invalid cargo weight",
        "Cargo weight must be greater than zero.",
      );
      return;
    }

    setLoading(true);

    try {
      let resolvedPickup = pickupCoordinates;

      if (!resolvedPickup) {
        resolvedPickup = await resolveAddress(pickupLocation.trim());
      }

      if (!resolvedPickup) {
        Alert.alert(
          "Pickup location not found",
          "We could not determine the coordinates for the pickup location. Please enter a more specific address or use your current location.",
        );
        return;
      }

      const resolvedDestination = await resolveAddress(destination.trim());

      if (!resolvedDestination) {
        Alert.alert(
          "Destination not found",
          "We could not determine the coordinates for the destination. Please enter a more specific address.",
        );
        return;
      }

      if (fareEstimate === null) {
        const pricing = await estimateBookingFare({
          pickupLocation: pickupLocation.trim(),
          destination: destination.trim(),
          pickupLatitude: resolvedPickup.latitude,
          pickupLongitude: resolvedPickup.longitude,
          destinationLatitude: resolvedDestination.latitude,
          destinationLongitude: resolvedDestination.longitude,
          cargoDescription: cargoDescription.trim() || undefined,
          truckCategory,
          cargoWeight: numericWeight,
        });

        setFareEstimate(pricing.estimatedFare);
        setDistanceKm(pricing.distanceKm);
        return;
      }

      if (!paymentMethod) {
        Alert.alert(
          "Choose payment method",
          "Please select how you would like to proceed.",
        );
        return;
      }

      const booking = await createBooking({
        pickupLocation: pickupLocation.trim(),
        destination: destination.trim(),
        pickupLatitude: resolvedPickup.latitude,
        pickupLongitude: resolvedPickup.longitude,
        destinationLatitude: resolvedDestination.latitude,
        destinationLongitude: resolvedDestination.longitude,
        cargoDescription: cargoDescription.trim() || undefined,
        truckCategory,
        cargoWeight: numericWeight,
        paymentMethod,
      });

      router.replace(`/(customer)/bookings/${booking.id}`);
    } catch (error) {
      Alert.alert(
        fareEstimate === null
          ? "Unable to calculate fare"
          : "Unable to create shipment",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Book Transport</Text>

      <Text style={styles.subtitle}>
        Tell us what you need moved and where it needs to go.
      </Text>

      <Text style={styles.label}>Pickup location</Text>

      <TextInput
        value={pickupLocation}
        onChangeText={(value) => {
          setPickupLocation(value);
          setPickupCoordinates(null);
        }}
        placeholder="Where should we collect it?"
        style={styles.input}
      />

      <Pressable
        disabled={locationLoading || loading}
        onPress={useCurrentLocation}
        style={[
          styles.locationButton,
          (locationLoading || loading) && styles.buttonDisabled,
        ]}
      >
        {locationLoading ? (
          <ActivityIndicator />
        ) : (
          <Text style={styles.locationButtonText}>
            Use my current location
          </Text>
        )}
      </Pressable>

      {pickupCoordinates && (
        <Text style={styles.coordinateText}>
          Pickup location confirmed
        </Text>
      )}

      <Text style={styles.label}>Destination</Text>

      <TextInput
        value={destination}
        onChangeText={setDestination}
        placeholder="Where should we deliver it?"
        style={styles.input}
      />

      <Text style={styles.label}>Vehicle class required</Text>
      <Text style={styles.fieldHint}>
        Select the class of vehicle required for this shipment.
      </Text>

      <View style={styles.categoryList}>
        {TRUCK_CATEGORIES.map((category) => (
          <Pressable
            key={category}
            disabled={loading}
            onPress={() => {
              setTruckCategory(category);
              setFareEstimate(null);
              setDistanceKm(null);
              setPaymentMethod(null);
            }}
            style={[
              styles.categoryOption,
              truckCategory === category && styles.categoryOptionSelected,
            ]}
          >
            <Text
              style={[
                styles.categoryOptionText,
                truckCategory === category &&
                  styles.categoryOptionTextSelected,
              ]}
            >
              {formatTruckCategory(category)}
            </Text>

            <View
              style={[
                styles.categoryRadio,
                truckCategory === category && styles.categoryRadioSelected,
              ]}
            >
              {truckCategory === category && (
                <View style={styles.categoryRadioDot} />
              )}
            </View>
          </Pressable>
        ))}
      </View>

      {truckCategory ? (
        <View style={styles.classInfoBox}>
          <Text style={styles.classInfoTitle}>
            Recommended capacity: {VEHICLE_CLASS_SPEC[truckCategory].capacityRange}
          </Text>
          <Text style={styles.classInfoText}>
            {VEHICLE_CLASS_SPEC[truckCategory].profiles}
          </Text>
          {VEHICLE_CLASS_SPEC[truckCategory].capacityNote ? (
            <Text style={styles.classInfoNote}>
              {VEHICLE_CLASS_SPEC[truckCategory].capacityNote}
            </Text>
          ) : null}
        </View>
      ) : null}

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
          TransConet will use your shipment requirements and verified
          locations to connect your request with suitable transport capacity.
        </Text>
      </View>

      {fareEstimate !== null && (
        <View style={styles.fareCard}>
          <Text style={styles.fareLabel}>ESTIMATED TRANSPORT FARE</Text>
          <Text style={styles.fareAmount}>
            ₦{fareEstimate.toLocaleString("en-NG")}
          </Text>
          {distanceKm !== null && (
            <Text style={styles.distanceText}>
              Estimated distance: {distanceKm.toLocaleString("en-NG")} km
            </Text>
          )}
        </View>
      )}

      {fareEstimate !== null && (
        <View style={styles.paymentSection}>
          <Text style={styles.paymentTitle}>How would you like to arrange the fare?</Text>
          <Text style={styles.paymentSubtitle}>
            Choose how you want to proceed with this shipment.
          </Text>

          {[
            {
              value: "FLUTTERWAVE" as const,
              title: "Flutterwave",
              description: "Pay securely through the existing online payment flow.",
            },
            {
              value: "BANK_TRANSFER" as const,
              title: "Bank Transfer",
              description: "Pay by bank transfer using TransConet payment instructions.",
            },
            {
              value: "NEGOTIATE" as const,
              title: "Negotiate Fare",
              description: "Negotiate the transport fare directly with a transporter. The agreed fare is paid directly to the transporter, not through TransConet.",
            },
          ].map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setPaymentMethod(option.value)}
              disabled={loading}
              style={[
                styles.paymentOption,
                paymentMethod === option.value && styles.paymentOptionSelected,
              ]}
            >
              <View style={styles.paymentOptionHeader}>
                <Text style={styles.paymentOptionTitle}>{option.title}</Text>
                <View
                  style={[
                    styles.radio,
                    paymentMethod === option.value && styles.radioSelected,
                  ]}
                >
                  {paymentMethod === option.value && (
                    <View style={styles.radioDot} />
                  )}
                </View>
              </View>
              <Text style={styles.paymentOptionText}>
                {option.description}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <Pressable
        disabled={loading}
        onPress={submit}
        style={[styles.button, loading && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>
          {loading
            ? fareEstimate === null
              ? "Calculating fare..."
              : "Posting shipment..."
            : fareEstimate === null
              ? "Calculate Fare"
              : "Post Shipment & Continue"}
        </Text>
      </Pressable>

      <Pressable
        disabled={loading}
        onPress={() => router.back()}
        style={styles.cancel}
      >
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
  fieldHint: {
    fontSize: 13,
    color: "#667085",
    lineHeight: 19,
    marginTop: -2,
    marginBottom: 12,
  },
  categoryList: {
    marginBottom: 18,
  },
  classInfoBox: {
    marginTop: -4,
    marginBottom: 18,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#F9FAFB",
  },
  classInfoTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#101828",
    marginBottom: 6,
  },
  classInfoText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#475467",
  },
  classInfoNote: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    fontStyle: "italic",
    color: "#667085",
  },
  categoryOption: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryOptionSelected: {
    borderColor: "#175CD3",
    borderWidth: 2,
  },
  categoryOptionText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#344054",
    textTransform: "capitalize",
  },
  categoryOptionTextSelected: {
    color: "#175CD3",
  },
  categoryRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#98A2B3",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryRadioSelected: {
    borderColor: "#175CD3",
  },
  categoryRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#175CD3",
  },
  locationButton: {
    borderWidth: 1,
    borderColor: "#175CD3",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: -6,
    marginBottom: 10,
  },
  locationButtonText: {
    color: "#175CD3",
    fontSize: 15,
    fontWeight: "800",
  },
  coordinateText: {
    color: "#027A48",
    fontSize: 13,
    fontWeight: "700",
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
  fareCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#D0D5DD",
  },
  fareLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#667085",
    marginBottom: 6,
  },
  fareAmount: {
    fontSize: 30,
    fontWeight: "900",
    color: "#111827",
  },
  distanceText: {
    fontSize: 13,
    color: "#667085",
    marginTop: 6,
  },
  paymentSection: {
    marginBottom: 24,
  },
  paymentTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  paymentSubtitle: {
    fontSize: 14,
    color: "#667085",
    marginBottom: 12,
  },
  paymentOption: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  paymentOptionSelected: {
    borderColor: "#175CD3",
    borderWidth: 2,
  },
  paymentOptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  paymentOptionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  paymentOptionText: {
    fontSize: 13,
    color: "#667085",
    lineHeight: 19,
    marginTop: 6,
    paddingRight: 30,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#98A2B3",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: "#175CD3",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#175CD3",
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
