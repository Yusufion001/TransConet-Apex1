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
  type Vehicle,
} from "../../src/api/transporter";

const VEHICLE_TYPES = [
  "Truck",
  "Van",
  "Pickup",
  "Trailer",
  "Other",
];

const VEHICLE_CLASSES = [
  "Light",
  "Medium",
  "Heavy",
];

export default function TransporterVehicleScreen() {
  const user = useAuthStore((state) => state.user);

  const [registrationNumber, setRegistrationNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("");
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

    if (!registration || !vehicleType || !vehicleClass) {
      Alert.alert(
        "Incomplete vehicle details",
        "Please provide the registration number, vehicle type, and vehicle class.",
      );
      return;
    }

    try {
      setSaving(true);

      const createdVehicle = await createVehicle({
        registrationNumber: registration,
        vehicleType,
        vehicleClass,
      });

      setVehicle(createdVehicle);

      Alert.alert(
        "Vehicle submitted",
        "Your vehicle has been registered and is now pending verification.",
      );
    } catch (error) {
      console.error("Failed to create vehicle:", error);

      const message =
        error instanceof Error
          ? error.message
          : "The vehicle could not be registered.";

      Alert.alert("Vehicle registration failed", message);
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
                  {vehicleClassOption}
                </Text>
              </Pressable>
            ))}
          </View>

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

        {!vehicle ? (
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
                Register vehicle
              </Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            style={styles.primaryButton}
            onPress={handleContinue}
          >
            <Text style={styles.primaryButtonText}>
              Continue to review
            </Text>
          </Pressable>
        )}

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
    backgroundColor: "#FFFFFF",
  },
  container: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 24,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#111111",
    marginBottom: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#111111",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#666666",
  },
  progressRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  progressStep: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#E5E5E5",
  },
  progressStepActive: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#111111",
  },
  progressText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#777777",
    marginBottom: 24,
  },
  card: {
    borderWidth: 1,
    borderColor: "#E7E7E7",
    borderRadius: 16,
    padding: 18,
    backgroundColor: "#FFFFFF",
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#111111",
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: "#666666",
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#222222",
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#DCDCDC",
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#111111",
    backgroundColor: "#FFFFFF",
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  option: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#DCDCDC",
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  optionSelected: {
    backgroundColor: "#111111",
    borderColor: "#111111",
  },
  optionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#444444",
  },
  optionTextSelected: {
    color: "#FFFFFF",
  },
  statusBox: {
    marginTop: 22,
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#F5F5F5",
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111111",
    marginBottom: 4,
  },
  statusText: {
    fontSize: 13,
    color: "#666666",
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  exitButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    marginTop: 8,
  },
  exitButtonText: {
    color: "#666666",
    fontSize: 13,
    fontWeight: "700",
  },
});
