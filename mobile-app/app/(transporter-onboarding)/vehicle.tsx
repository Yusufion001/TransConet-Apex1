import React, { useEffect, useState } from "react";
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
import { router } from "expo-router";

import { useAuthStore } from "../../src/auth/auth.store";
import {
  createVehicle,
  getTransporterVehicles,
  updateVehicle,
  type Vehicle,
} from "../../src/api/transporter";

const FUEL_TYPES = ["PETROL", "DIESEL"] as const;

const VEHICLE_TYPES = [
  "Truck",
  "Van",
  "Pickup",
  "Trailer",
  "Other",
];

const VEHICLE_CLASSES = [
  "MINI_TRUCK",
  "LIGHT_TRUCK",
  "MEDIUM_TRUCK",
  "HEAVY_TRUCK",
  "CONTAINER_TRUCK",
  "REFRIGERATED_TRUCK",
  "TANKER",
  "SPECIALIZED",
] as const;

const VEHICLE_CLASS_SPEC: Record<
  (typeof VEHICLE_CLASSES)[number],
  {
    capacityRange: string;
    profiles: string;
    capacityNote?: string;
  }
> = {
  MINI_TRUCK: {
    capacityRange: "500–1,500 kg",
    profiles: "Last-mile delivery, small parcels, retail distribution.",
  },
  LIGHT_TRUCK: {
    capacityRange: "1,500–4,000 kg",
    profiles: "Urban FMCG distribution, light construction materials, furniture.",
  },
  MEDIUM_TRUCK: {
    capacityRange: "4,000–15,000 kg",
    profiles: "Regional inter-state haulage, agricultural yields, commercial electronics.",
  },
  HEAVY_TRUCK: {
    capacityRange: "15,000–30,000 kg",
    profiles: "Long-haul bulk freight, heavy industrial goods, large-scale agriculture.",
  },
  CONTAINER_TRUCK: {
    capacityRange: "20,000–35,000 kg",
    profiles: "Port clearance, imported goods, standard 20ft/40ft shipping containers.",
  },
  REFRIGERATED_TRUCK: {
    capacityRange: "1,500–25,000 kg",
    profiles: "Temperature-sensitive perishables or pharmaceuticals; capacity varies by chassis.",
  },
  TANKER: {
    capacityRange: "10,000–45,000 kg",
    profiles: "Liquid bulk such as petroleum products, vegetable oils, and chemicals.",
    capacityNote: "Approximately 10,000–45,000 liters depending on tanker configuration.",
  },
  SPECIALIZED: {
    capacityRange: "30,000–100,000+ kg",
    profiles: "Lowbeds/multi-axle trailers, oversized cargo, industrial plants and heavy construction equipment.",
  },
} as const;

export default function TransporterVehicleScreen() {
  const user = useAuthStore((state) => state.user);

  const [registrationNumber, setRegistrationNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [fuelType, setFuelType] = useState<(typeof FUEL_TYPES)[number] | "">("");
  const [vehicleBodyType, setVehicleBodyType] = useState("");
  const [vehicleClass, setVehicleClass] = useState("");
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadExistingVehicle = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const vehicles = await getTransporterVehicles(user.id);

        if (vehicles.length > 0) {
          setVehicle(vehicles[0]);
          setRegistrationNumber(vehicles[0].registrationNumber);
          setVehicleType(vehicles[0].vehicleType);
          setFuelType(vehicles[0].fuelType ?? "");
          setVehicleBodyType(vehicles[0].vehicleBodyType ?? "");
          setVehicleClass(vehicles[0].vehicleClass);
        }
      } catch (error) {
        console.error("Failed to load transporter vehicles:", error);
      } finally {
        setLoading(false);
      }
    };

    void loadExistingVehicle();
  }, [user?.id]);

  const handleSubmit = async () => {
    if (!user?.id) {
      Alert.alert(
        "Session required",
        "Please sign in again before continuing.",
      );
      return;
    }

    const registration = registrationNumber.trim();

    if (
      !registration ||
      !vehicleType ||
      !fuelType ||
      !vehicleBodyType ||
      !vehicleClass
    ) {
      Alert.alert(
        "Incomplete vehicle details",
        "Please provide the registration number, vehicle type, fuel type, vehicle body type, and vehicle class.",
      );
      return;
    }

    try {
      setSaving(true);

      const savedVehicle = vehicle
        ? await updateVehicle(vehicle.id, {
            registrationNumber: registration,
            vehicleType,
            fuelType,
            vehicleBodyType,
            vehicleClass,
          })
        : await createVehicle({
            registrationNumber: registration,
            vehicleType,
            fuelType,
            vehicleBodyType,
            vehicleClass,
          });

      setVehicle(savedVehicle);

      Alert.alert(
        vehicle ? "Vehicle updated" : "Vehicle submitted",
        vehicle
          ? "Your vehicle details have been updated and are now pending verification."
          : "Your vehicle has been registered and is now pending verification.",
      );
    } catch (error) {
      console.error("Failed to save vehicle:", error);

      const responseData =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: unknown }).response === "object" &&
        (error as { response?: { data?: unknown } }).response?.data &&
        typeof (error as { response?: { data?: unknown } }).response?.data === "object"
          ? (error as { response: { data: Record<string, unknown> } }).response.data
          : null;

      const message =
        typeof responseData?.error === "string"
          ? responseData.error
          : typeof responseData?.message === "string"
            ? responseData.message
            : error instanceof Error
              ? error.message
              : "The vehicle could not be saved.";

      Alert.alert(
        vehicle ? "Vehicle update failed" : "Vehicle registration failed",
        message,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = () => {
    router.replace("/(transporter-onboarding)/review");
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>TRANSCONET</Text>
          <Text style={styles.title}>Add your vehicle</Text>
          <Text style={styles.subtitle}>
            Register the vehicle you will use for transport operations.
          </Text>
        </View>

        <View style={styles.progressRow}>
          <View style={styles.progressStepActive} />
          <View style={styles.progressStepActive} />
          <View style={styles.progressStepActive} />
          <View style={styles.progressStep} />
        </View>

        <Text style={styles.progressText}>STEP 3 OF 4</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vehicle details</Text>
          <Text style={styles.cardDescription}>
            Enter the details exactly as they appear on your vehicle
            registration.
          </Text>

          <Text style={styles.label}>Registration number</Text>
          <TextInput
            value={registrationNumber}
            onChangeText={setRegistrationNumber}
            placeholder="e.g. ABC-123-XY"
            placeholderTextColor="#999999"
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.input}
            editable={!saving}
          />

          <Text style={styles.label}>Vehicle type</Text>
          <View style={styles.options}>
            {VEHICLE_TYPES.map((type) => (
              <Pressable
                key={type}
                onPress={() => setVehicleType(type)}
                disabled={saving}
                style={[
                  styles.option,
                  vehicleType === type && styles.optionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    vehicleType === type && styles.optionTextSelected,
                  ]}
                >
                  {type}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Fuel type</Text>
          <View style={styles.options}>
            {FUEL_TYPES.map((fuelTypeOption) => (
              <Pressable
                key={fuelTypeOption}
                onPress={() => setFuelType(fuelTypeOption)}
                disabled={saving}
                style={[
                  styles.option,
                  fuelType === fuelTypeOption && styles.optionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    fuelType === fuelTypeOption && styles.optionTextSelected,
                  ]}
                >
                  {fuelTypeOption}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Vehicle body type</Text>
          <TextInput
            value={vehicleBodyType}
            onChangeText={setVehicleBodyType}
            placeholder="e.g. Flatbed or Tarpaulin"
            placeholderTextColor="#999999"
            autoCapitalize="words"
            autoCorrect={false}
            style={styles.input}
            editable={!saving}
          />

          <Text style={styles.label}>Vehicle class</Text>
          <View style={styles.options}>
            {VEHICLE_CLASSES.map((vehicleClassOption) => (
              <Pressable
                key={vehicleClassOption}
                onPress={() => setVehicleClass(vehicleClassOption)}
                disabled={saving}
                style={[
                  styles.option,
                  vehicleClass === vehicleClassOption &&
                    styles.optionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    vehicleClass === vehicleClassOption &&
                      styles.optionTextSelected,
                  ]}
                >
                  {vehicleClassOption.replace(/_/g, " ")}
                </Text>
              </Pressable>
            ))}
          </View>

          {vehicleClass ? (
            <View style={styles.classInfoBox}>
              <Text style={styles.classInfoTitle}>
                Recommended capacity:{" "}
                {VEHICLE_CLASS_SPEC[vehicleClass as keyof typeof VEHICLE_CLASS_SPEC]
                  .capacityRange}
              </Text>
              <Text style={styles.classInfoText}>
                {VEHICLE_CLASS_SPEC[vehicleClass as keyof typeof VEHICLE_CLASS_SPEC]
                  .profiles}
              </Text>
              {VEHICLE_CLASS_SPEC[vehicleClass as keyof typeof VEHICLE_CLASS_SPEC]
                .capacityNote ? (
                <Text style={styles.classInfoNote}>
                  {
                    VEHICLE_CLASS_SPEC[
                      vehicleClass as keyof typeof VEHICLE_CLASS_SPEC
                    ].capacityNote
                  }
                </Text>
              ) : null}
            </View>
          ) : null}

          {vehicle ? (
            <View style={styles.statusBox}>
              <Text style={styles.statusTitle}>Vehicle registered</Text>
              <Text style={styles.statusText}>
                Verification status:{" "}
                {vehicle.verificationStatus || "PENDING"}
              </Text>
            </View>
          ) : null}
        </View>

        <Pressable
          style={[
            styles.primaryButton,
            saving && styles.buttonDisabled,
          ]}
          onPress={() => void handleSubmit()}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {vehicle ? "Update vehicle" : "Register vehicle"}
            </Text>
          )}
        </Pressable>

        {vehicle ? (
          <Pressable
            style={styles.secondaryButton}
            onPress={handleContinue}
            disabled={saving}
          >
            <Text style={styles.secondaryButtonText}>
              Continue to review
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          style={styles.exitButton}
          onPress={() => router.replace("/(transporter)")}
        >
          <Text style={styles.exitButtonText}>Exit setup</Text>
        </Pressable>
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
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 52,
  },
  header: {
    marginBottom: 22,
  },
  eyebrow: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#E8EEFF",
    color: "#4169E1",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.8,
    marginBottom: 14,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    color: "#101B3A",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: "#667085",
    maxWidth: 480,
  },
  progressRow: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 8,
  },
  progressStep: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#DCE3F3",
  },
  progressStepActive: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#4169E1",
  },
  progressText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#667085",
    marginBottom: 20,
  },
  card: {
    borderWidth: 1,
    borderColor: "#E3E8F4",
    borderRadius: 22,
    padding: 18,
    backgroundColor: "#FFFFFF",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900",
    color: "#101B3A",
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
    color: "#344054",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: "#D7DEEC",
    borderRadius: 14,
    paddingHorizontal: 15,
    fontSize: 15,
    fontWeight: "600",
    color: "#101B3A",
    backgroundColor: "#FBFCFF",
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  option: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#D7DEEC",
    borderRadius: 13,
    paddingHorizontal: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  optionSelected: {
    backgroundColor: "#4169E1",
    borderColor: "#4169E1",
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 2,
  },
  optionText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#475467",
  },
  optionTextSelected: {
    color: "#FFFFFF",
  },
  classInfoBox: {
    marginTop: 14,
    marginBottom: 6,
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#C9D7FF",
    backgroundColor: "#F0F4FF",
  },
  classInfoTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "900",
    color: "#1F3FAE",
    marginBottom: 6,
  },
  classInfoText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#475467",
  },
  classInfoNote: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 17,
    fontStyle: "italic",
    color: "#667085",
  },
  statusBox: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#C9D7FF",
    borderRadius: 15,
    padding: 15,
    backgroundColor: "#F0F4FF",
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#1F3FAE",
    marginBottom: 5,
  },
  statusText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#475467",
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 15,
    backgroundColor: "#4169E1",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.1,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#C9D7FF",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  secondaryButtonText: {
    color: "#4169E1",
    fontSize: 15,
    fontWeight: "900",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  exitButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    marginTop: 8,
  },
  exitButtonText: {
    color: "#667085",
    fontSize: 13,
    fontWeight: "800",
  },
});
