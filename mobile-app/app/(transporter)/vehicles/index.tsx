import {
  startMarketplaceVehicleLocationTracking,
  stopMarketplaceVehicleLocationTracking,
} from "../../../src/realtime/location-publisher";

import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createVehicle,
  getTransporterVehicles,
  updateVehicle,
  updateVehicleAvailability,
} from "../../../src/api/transporter";
import { useAuthStore } from "../../../src/auth/auth.store";

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

type VehicleClass = (typeof VEHICLE_CLASSES)[number];

const VEHICLE_CLASS_SPEC: Record<
  VehicleClass,
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

function formatVehicleClass(value: string) {
  return value.replace(/_/g, " ");
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default function TransporterFleet() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);

  const [registrationNumber, setRegistrationNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleBodyType, setVehicleBodyType] = useState("");
  const [vehicleClass, setVehicleClass] = useState<VehicleClass | "">("");
  const [fuelType, setFuelType] = useState<"PETROL" | "DIESEL" | "">("");

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [color, setColor] = useState("");
  const [capacity, setCapacity] = useState("");

  const vehiclesQuery = useQuery({
    queryKey: ["transporter-vehicles", user?.id],
    queryFn: () => getTransporterVehicles(user!.id),
    enabled: Boolean(user?.id),
  });

  const vehicles = vehiclesQuery.data ?? [];
  const vehicle = vehicles[0] ?? null;

  const resetForm = () => {
    setRegistrationNumber("");
    setVehicleType("");
    setVehicleBodyType("");
    setVehicleClass("");
    setFuelType("");
    setMake("");
    setModel("");
    setYear("");
    setColor("");
    setCapacity("");
    setEditingVehicleId(null);
    setShowAddForm(false);
  };

  const refreshVehicles = () => {
    void queryClient.invalidateQueries({
      queryKey: ["transporter-vehicles", user?.id],
    });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      createVehicle({
        registrationNumber: registrationNumber.trim(),
        vehicleType: vehicleType.trim(),
        vehicleBodyType: vehicleBodyType.trim() || undefined,
        vehicleClass: vehicleClass as VehicleClass,
        fuelType: fuelType as "PETROL" | "DIESEL",
        ...(year.trim() ? { year: Number(year) } : {}),
      }),
    onSuccess: () => {
      resetForm();
      refreshVehicles();
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateVehicle(editingVehicleId!, {
        ...(make.trim() ? { make: make.trim() } : {}),
        ...(model.trim() ? { model: model.trim() } : {}),
        ...(year.trim() ? { year: Number(year) } : {}),
        ...(color.trim() ? { color: color.trim() } : {}),
        ...(capacity.trim() ? { capacity: Number(capacity) } : {}),
      }),
    onSuccess: () => {
      resetForm();
      refreshVehicles();
    },
  });

  const availabilityMutation = useMutation({
    mutationFn: async ({
      vehicleId,
      availabilityStatus,
    }: {
      vehicleId: string;
      availabilityStatus: "AVAILABLE" | "UNAVAILABLE";
    }) => {
      const updatedVehicle = await updateVehicleAvailability(
        vehicleId,
        availabilityStatus,
      );

      if (availabilityStatus === "AVAILABLE") {
        try {
          await startMarketplaceVehicleLocationTracking(
            vehicleId,
          );
        } catch (error) {
          try {
            await updateVehicleAvailability(
              vehicleId,
              "UNAVAILABLE",
            );
          } catch (rollbackError) {
            console.warn(
              "Failed to roll back vehicle availability after marketplace location failure:",
              rollbackError,
            );
          }

          throw error;
        }
      } else {
        await stopMarketplaceVehicleLocationTracking(
          vehicleId,
        );
      }

      return updatedVehicle;
    },
    onSuccess: () => {
      refreshVehicles();
    },
  });

  const editingVehicle = editingVehicleId
    ? vehicles.find((vehicle) => vehicle.id === editingVehicleId)
    : null;

  const addFormValid =
    registrationNumber.trim().length > 0 &&
    vehicleType.trim().length > 0 &&
    vehicleBodyType.trim().length > 0 &&
    vehicleClass.length > 0 &&
    fuelType.length > 0 &&
    !createMutation.isPending;

  const updateFormValid =
    Boolean(editingVehicleId) &&
    (!year.trim() || (Number.isInteger(Number(year)) && Number(year) >= 1900 && Number(year) <= 2100)) &&
    (!capacity.trim() || (Number.isFinite(Number(capacity)) && Number(capacity) > 0)) &&
    !updateMutation.isPending;

  const startEditing = (vehicle: (typeof vehicles)[number]) => {
    setEditingVehicleId(vehicle.id);
    setShowAddForm(false);
    setMake(vehicle.make ?? "");
    setModel(vehicle.model ?? "");
    setYear(vehicle.year != null ? String(vehicle.year) : "");
    setColor(vehicle.color ?? "");
    setCapacity(vehicle.capacity != null ? String(vehicle.capacity) : "");
  };

  if (!user?.id) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Transporter account unavailable</Text>
        <Text style={styles.errorText}>
          Please sign in again to manage your fleet.
        </Text>
      </View>
    );
  }

  if (vehiclesQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading your fleet...</Text>
      </View>
    );
  }

  if (vehiclesQuery.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Unable to load Fleet</Text>
        <Text style={styles.errorText}>
          We could not retrieve your registered vehicles.
        </Text>

        <Pressable onPress={() => vehiclesQuery.refetch()} style={styles.darkButton}>
          <Text style={styles.darkButtonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={vehiclesQuery.isRefetching}
          onRefresh={() => {
            void vehiclesQuery.refetch();
          }}
        />
      }
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.eyebrow}>VEHICLE MANAGEMENT</Text>
      <Text style={styles.title}>Your Vehicle</Text>
      <Text style={styles.subtitle}>
        Manage your registered vehicle and keep it ready for TransConet operations.
      </Text>

      <View style={styles.statsGrid}>
        <Stat label="VEHICLE" value={vehicle ? 1 : 0} />
        <Stat
          label="VERIFIED"
          value={vehicle?.verificationStatus === "APPROVED" ? 1 : 0}
        />
        <Stat
          label="AVAILABLE"
          value={vehicle?.availabilityStatus === "AVAILABLE" ? 1 : 0}
        />
        <Stat
          label="READY"
          value={
            vehicle?.verificationStatus === "APPROVED" &&
            vehicle?.availabilityStatus === "AVAILABLE"
              ? 1
              : 0
          }
        />
      </View>

      {!vehicle && !showAddForm && !editingVehicleId ? (
        <Pressable
          onPress={() => setShowAddForm(true)}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>+ Add Vehicle</Text>
        </Pressable>
      ) : null}

      {showAddForm ? (
        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.sectionTitle}>Register vehicle</Text>
            <Pressable onPress={resetForm}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>

          <Field
            label="REGISTRATION NUMBER"
            value={registrationNumber}
            onChangeText={setRegistrationNumber}
            placeholder="e.g. ABC-123-XY"
          />

          <Field
            label="VEHICLE TYPE"
            value={vehicleType}
            onChangeText={setVehicleType}
            placeholder="e.g. Truck"
          />

          <Field
            label="VEHICLE BODY TYPE"
            value={vehicleBodyType}
            onChangeText={setVehicleBodyType}
            placeholder="e.g. Flatbed or Tarpaulin"
          />

          <Text style={styles.fieldLabel}>FUEL TYPE</Text>

          <View style={styles.classGrid}>
            {(["PETROL", "DIESEL"] as const).map((item) => {
              const selected = fuelType === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => setFuelType(item)}
                  style={[
                    styles.classOption,
                    selected && styles.classOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.classOptionText,
                      selected && styles.classOptionTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>VEHICLE CLASS</Text>

          <View style={styles.classGrid}>
            {VEHICLE_CLASSES.map((item) => {
              const selected = vehicleClass === item;

              return (
                <Pressable
                  key={item}
                  onPress={() => setVehicleClass(item)}
                  style={[
                    styles.classOption,
                    selected && styles.classOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.classOptionText,
                      selected && styles.classOptionTextSelected,
                    ]}
                  >
                    {formatVehicleClass(item)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {vehicleClass ? (
            <View style={styles.classInfoCard}>
              <Text style={styles.classInfoTitle}>
                {VEHICLE_CLASS_SPEC[vehicleClass].capacityRange}
              </Text>
              <Text style={styles.classInfoText}>
                {VEHICLE_CLASS_SPEC[vehicleClass].profiles}
              </Text>
              {VEHICLE_CLASS_SPEC[vehicleClass].capacityNote ? (
                <Text style={styles.classInfoNote}>
                  {VEHICLE_CLASS_SPEC[vehicleClass].capacityNote}
                </Text>
              ) : null}
            </View>
          ) : null}

          {createMutation.isError ? (
            <Text style={styles.formError}>
              Unable to register this vehicle. Check the details and try again.
            </Text>
          ) : null}

          <Pressable
            disabled={!addFormValid}
            onPress={() => createMutation.mutate()}
            style={[
              styles.primaryButton,
              !addFormValid && styles.disabledButton,
            ]}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Register Vehicle</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {editingVehicle ? (
        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <View>
              <Text style={styles.sectionTitle}>Edit vehicle</Text>
              <Text style={styles.formSubtitle}>
                {editingVehicle.registrationNumber}
              </Text>
            </View>

            <Pressable onPress={resetForm}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>

          <Field
            label="MAKE"
            value={make}
            onChangeText={setMake}
            placeholder="e.g. Mercedes-Benz"
          />

          <Field
            label="MODEL"
            value={model}
            onChangeText={setModel}
            placeholder="e.g. Actros"
          />

          <Field
            label="YEAR"
            value={year}
            onChangeText={setYear}
            placeholder="e.g. 2024"
            keyboardType="number-pad"
          />

          <Field
            label="COLOR"
            value={color}
            onChangeText={setColor}
            placeholder="e.g. White"
          />

          <Field
            label="CAPACITY"
            value={capacity}
            onChangeText={setCapacity}
            placeholder="e.g. 10"
            keyboardType="decimal-pad"
          />

          {updateMutation.isError ? (
            <Text style={styles.formError}>
              Unable to update this vehicle. Check the supplied values.
            </Text>
          ) : null}

          <Pressable
            disabled={!updateFormValid}
            onPress={() => updateMutation.mutate()}
            style={[
              styles.primaryButton,
              !updateFormValid && styles.disabledButton,
            ]}
          >
            {updateMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Save Changes</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.eyebrow}>REGISTERED VEHICLE</Text>
        <Text style={styles.sectionTitle}>
          {vehicle ? "1 registered vehicle" : "No registered vehicle"}
        </Text>
      </View>

      {vehicles.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No vehicles registered</Text>
          <Text style={styles.emptyText}>
            Register your vehicle to begin accepting TransConet loads.
          </Text>

          {!showAddForm ? (
            <Pressable
              onPress={() => setShowAddForm(true)}
              style={styles.darkButton}
            >
              <Text style={styles.darkButtonText}>Add First Vehicle</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        vehicles.slice(0, 1).map((vehicle) => (
          <View key={vehicle.id} style={styles.vehicleCard}>
            <View style={styles.vehicleHeader}>
              <View style={styles.vehicleHeaderText}>
                <Text style={styles.registration}>
                  {vehicle.registrationNumber}
                </Text>
                <Text style={styles.vehicleType}>
                  {formatVehicleClass(vehicle.vehicleClass)}
                  {vehicle.vehicleBodyType
                    ? ` · ${vehicle.vehicleBodyType}`
                    : ""}
                  {vehicle.fuelType ? ` · ${vehicle.fuelType}` : ""}
                </Text>
              </View>

              <Pressable
                onPress={() => startEditing(vehicle)}
                style={styles.editButton}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </Pressable>
            </View>

            <View style={styles.badgeRow}>
              <StatusBadge
                label="VERIFICATION"
                value={vehicle.verificationStatus}
                positive={vehicle.verificationStatus === "APPROVED"}
              />

              <StatusBadge
                label="AVAILABILITY"
                value={vehicle.availabilityStatus}
                positive={vehicle.availabilityStatus === "AVAILABLE"}
              />
            </View>

            <View style={styles.divider} />

            <Detail
              label="MAKE / MODEL"
              value={
                vehicle.make || vehicle.model
                  ? `${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim()
                  : "Not specified"
              }
            />

            <Detail
              label="YEAR"
              value={vehicle.year != null ? String(vehicle.year) : "Not specified"}
            />

            <Detail
              label="COLOR"
              value={vehicle.color ?? "Not specified"}
            />

            <Detail
              label="CAPACITY"
              value={
                vehicle.capacity != null
                  ? String(vehicle.capacity)
                  : "Not specified"
              }
            />

            {vehicle.verificationStatus === "APPROVED" &&
            vehicle.availabilityStatus !== "ON_TRIP" ? (
              <Pressable
                disabled={availabilityMutation.isPending}
                onPress={() =>
                  availabilityMutation.mutate({
                    vehicleId: vehicle.id,
                    availabilityStatus:
                      vehicle.availabilityStatus === "AVAILABLE"
                        ? "UNAVAILABLE"
                        : "AVAILABLE",
                  })
                }
                style={[
                  styles.availabilityButton,
                  vehicle.availabilityStatus === "AVAILABLE"
                    ? styles.availabilityButtonUnavailable
                    : styles.availabilityButtonAvailable,
                  availabilityMutation.isPending &&
                    styles.disabledButton,
                ]}
              >
                {availabilityMutation.isPending ? (
                  <ActivityIndicator />
                ) : (
                  <Text
                    style={[
                      styles.availabilityButtonText,
                      vehicle.availabilityStatus === "AVAILABLE"
                        ? styles.availabilityButtonTextUnavailable
                        : styles.availabilityButtonTextAvailable,
                    ]}
                  >
                    {vehicle.availabilityStatus === "AVAILABLE"
                      ? "Set Unavailable"
                      : "Set Available"}
                  </Text>
                )}
              </Pressable>
            ) : null}

            {vehicle.availabilityStatus === "ON_TRIP" ? (
              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>Vehicle currently on trip</Text>
                <Text style={styles.infoText}>
                  Availability is controlled automatically while this vehicle
                  is assigned to an active trip.
                </Text>
              </View>
            ) : vehicle.availabilityStatus !== "AVAILABLE" ? (
              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>Vehicle not available for bids</Text>
                <Text style={styles.infoText}>
                  Vehicles must be approved and available before they can be
                  selected for Capacity Exchange bids.
                </Text>
              </View>
            ) : null}

            {availabilityMutation.isError ? (
              <Text style={styles.formError}>
                Unable to change vehicle availability. Please try again.
              </Text>
            ) : null}
          </View>
        ))
      )}

      <View style={styles.footer}>
        <Text style={styles.footerBrand}>TRANSCONET</Text>
        <Text style={styles.footerText}>
          Connected logistics. Built for movement.
        </Text>
      </View>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "number-pad" | "decimal-pad";
}) {
  return (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#98A2B3"
        keyboardType={keyboardType}
        style={styles.input}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function StatusBadge({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive: boolean;
}) {
  return (
    <View style={styles.badge}>
      <View
        style={[
          styles.badgeDot,
          positive ? styles.badgeDotPositive : styles.badgeDotNeutral,
        ]}
      />
      <View>
        <Text style={styles.badgeLabel}>{label}</Text>
        <Text style={styles.badgeValue}>{statusLabel(value)}</Text>
      </View>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 48,
    backgroundColor: "#F4F7FF",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F4F7FF",
  },

  loadingText: {
    marginTop: 12,
    color: "#667085",
    fontSize: 14,
    fontWeight: "600",
  },

  errorTitle: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "900",
    color: "#101B3A",
  },

  errorText: {
    marginTop: 8,
    textAlign: "center",
    lineHeight: 21,
    fontSize: 14,
    color: "#667085",
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.6,
    color: "#4169E1",
  },

  title: {
    marginTop: 5,
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "900",
    color: "#101B3A",
  },

  subtitle: {
    marginTop: 8,
    marginBottom: 22,
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },

  statCard: {
    width: "48%",
    minHeight: 88,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7F5",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  statValue: {
    fontSize: 27,
    lineHeight: 31,
    fontWeight: "900",
    color: "#101B3A",
  },

  statLabel: {
    marginTop: 5,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#98A2B3",
  },

  primaryButton: {
    minHeight: 52,
    marginBottom: 17,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4169E1",
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.15,
  },

  disabledButton: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },

  darkButton: {
    marginTop: 17,
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#101B3A",
  },

  darkButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },

  formCard: {
    marginBottom: 20,
    padding: 19,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7F5",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },

  formHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  sectionHeader: {
    marginTop: 10,
    marginBottom: 14,
  },

  sectionTitle: {
    marginTop: 4,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "900",
    color: "#101B3A",
  },

  formSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#667085",
  },

  cancelText: {
    paddingVertical: 5,
    paddingLeft: 10,
    fontSize: 13,
    fontWeight: "900",
    color: "#B42318",
  },

  fieldLabel: {
    marginTop: 5,
    marginBottom: 7,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#667085",
  },

  input: {
    minHeight: 51,
    marginBottom: 13,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#D9E0EF",
    borderRadius: 13,
    backgroundColor: "#FBFCFF",
    fontSize: 15,
    color: "#101B3A",
  },

  classGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 15,
  },

  classOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#D9E0EF",
    backgroundColor: "#FFFFFF",
  },

  classOptionSelected: {
    borderColor: "#4169E1",
    backgroundColor: "#EEF3FF",
  },

  classOptionText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475467",
  },

  classOptionTextSelected: {
    color: "#4169E1",
  },

  classInfoCard: {
    marginTop: 12,
    marginBottom: 15,
    padding: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DCE5FB",
    backgroundColor: "#F4F7FF",
  },

  classInfoTitle: {
    marginBottom: 6,
    fontSize: 14,
    fontWeight: "900",
    color: "#101B3A",
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

  formError: {
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 19,
    color: "#B42318",
  },

  availabilityButton: {
    minHeight: 47,
    marginTop: 17,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  availabilityButtonAvailable: {
    borderColor: "#4169E1",
    backgroundColor: "#EEF3FF",
  },

  availabilityButtonUnavailable: {
    borderColor: "#D92D20",
    backgroundColor: "#FFF4F2",
  },

  availabilityButtonText: {
    fontSize: 14,
    fontWeight: "900",
  },

  availabilityButtonTextAvailable: {
    color: "#4169E1",
  },

  availabilityButtonTextUnavailable: {
    color: "#B42318",
  },

  vehicleCard: {
    marginBottom: 15,
    padding: 19,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7F5",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.055,
    shadowRadius: 14,
    elevation: 2,
  },

  vehicleHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  vehicleHeaderText: {
    flex: 1,
    paddingRight: 12,
  },

  registration: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "900",
    letterSpacing: 0.2,
    color: "#101B3A",
  },

  vehicleType: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: "#667085",
  },

  editButton: {
    minHeight: 37,
    paddingHorizontal: 13,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF3FF",
    borderWidth: 1,
    borderColor: "#DCE5FB",
  },

  editButtonText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#4169E1",
  },

  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 17,
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: "#F7F9FD",
    borderWidth: 1,
    borderColor: "#E8ECF5",
  },

  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  badgeDotPositive: {
    backgroundColor: "#12B76A",
  },

  badgeDotNeutral: {
    backgroundColor: "#F79009",
  },

  badgeLabel: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.8,
    color: "#98A2B3",
  },

  badgeValue: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "900",
    color: "#344054",
  },

  divider: {
    height: 1,
    marginVertical: 16,
    backgroundColor: "#E8ECF5",
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    marginBottom: 10,
  },

  detailLabel: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#98A2B3",
  },

  detailValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#344054",
  },

  infoBox: {
    marginTop: 8,
    padding: 14,
    borderRadius: 13,
    backgroundColor: "#FFF8E8",
    borderWidth: 1,
    borderColor: "#F3E0B0",
  },

  infoTitle: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "900",
    color: "#7A2E0E",
  },

  infoText: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: "#93370D",
  },

  emptyCard: {
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 28,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7F5",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#101B3A",
  },

  emptyText: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
  },

  footer: {
    alignItems: "center",
    marginTop: 30,
    paddingTop: 10,
  },

  footerBrand: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    color: "#AAB4CA",
  },

  footerText: {
    marginTop: 5,
    fontSize: 11,
    color: "#AAB4CA",
  },
});
