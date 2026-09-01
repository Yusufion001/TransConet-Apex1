import { useMemo, useState } from "react";
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
} from "../../../src/api/transporter";
import { useAuthStore } from "../../../src/auth/auth.store";

const VEHICLE_CLASSES = [
  "MOTORCYCLE",
  "MINI_VAN",
  "CARGO_VAN",
  "PICKUP",
  "LIGHT_TRUCK",
  "MEDIUM_TRUCK",
  "HEAVY_TRUCK",
  "CONTAINER",
  "FLATBED",
  "REFRIGERATED_TRUCK",
  "TANKER",
  "LOWBED",
] as const;

type VehicleClass = (typeof VEHICLE_CLASSES)[number];

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
  const [vehicleClass, setVehicleClass] = useState<VehicleClass | "">("");

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

  const stats = useMemo(() => {
    return {
      total: vehicles.length,
      pending: vehicles.filter(
        (vehicle) => vehicle.verificationStatus === "PENDING",
      ).length,
      approved: vehicles.filter(
        (vehicle) => vehicle.verificationStatus === "APPROVED",
      ).length,
      available: vehicles.filter(
        (vehicle) => vehicle.availabilityStatus === "AVAILABLE",
      ).length,
    };
  }, [vehicles]);

  const resetForm = () => {
    setRegistrationNumber("");
    setVehicleType("");
    setVehicleClass("");
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
        vehicleClass: vehicleClass as VehicleClass,
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

  const editingVehicle = editingVehicleId
    ? vehicles.find((vehicle) => vehicle.id === editingVehicleId)
    : null;

  const addFormValid =
    registrationNumber.trim().length > 0 &&
    vehicleType.trim().length > 0 &&
    vehicleClass.length > 0 &&
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
      <Text style={styles.eyebrow}>FLEET MANAGEMENT</Text>
      <Text style={styles.title}>Your Fleet</Text>
      <Text style={styles.subtitle}>
        Manage your registered vehicles and monitor their operational readiness.
      </Text>

      <View style={styles.statsGrid}>
        <Stat label="TOTAL" value={stats.total} />
        <Stat label="PENDING" value={stats.pending} />
        <Stat label="APPROVED" value={stats.approved} />
        <Stat label="AVAILABLE" value={stats.available} />
      </View>

      {!showAddForm && !editingVehicleId ? (
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
            placeholder="e.g. Isuzu Truck"
          />

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
        <Text style={styles.eyebrow}>REGISTERED VEHICLES</Text>
        <Text style={styles.sectionTitle}>
          {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"}
        </Text>
      </View>

      {vehicles.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No vehicles registered</Text>
          <Text style={styles.emptyText}>
            Add your first vehicle to begin building your TransConet fleet.
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
        vehicles.map((vehicle) => (
          <View key={vehicle.id} style={styles.vehicleCard}>
            <View style={styles.vehicleHeader}>
              <View style={styles.vehicleHeaderText}>
                <Text style={styles.registration}>
                  {vehicle.registrationNumber}
                </Text>
                <Text style={styles.vehicleType}>
                  {vehicle.vehicleType} · {formatVehicleClass(vehicle.vehicleClass)}
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

            {vehicle.availabilityStatus !== "AVAILABLE" ? (
              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>Vehicle not available for bids</Text>
                <Text style={styles.infoText}>
                  Vehicles must be approved and available before they can be
                  selected for Capacity Exchange bids.
                </Text>
              </View>
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
    paddingTop: 58,
    paddingBottom: 40,
    backgroundColor: "#F5F7FA",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F5F7FA",
  },
  loadingText: {
    marginTop: 12,
    color: "#667085",
    fontSize: 14,
  },
  errorTitle: {
    textAlign: "center",
    fontSize: 19,
    fontWeight: "800",
    color: "#101828",
  },
  errorText: {
    marginTop: 8,
    textAlign: "center",
    lineHeight: 21,
    color: "#667085",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.6,
    color: "#0B63CE",
  },
  title: {
    marginTop: 5,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    color: "#101828",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 22,
    fontSize: 15,
    lineHeight: 22,
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
    minHeight: 82,
    padding: 15,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
  },
  statValue: {
    fontSize: 25,
    fontWeight: "800",
    color: "#101828",
  },
  statLabel: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#98A2B3",
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B63CE",
    marginBottom: 16,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.45,
  },
  darkButton: {
    marginTop: 16,
    minHeight: 46,
    paddingHorizontal: 20,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#101828",
  },
  darkButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  formCard: {
    marginBottom: 18,
    padding: 18,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D0D5DD",
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 17,
  },
  sectionHeader: {
    marginTop: 10,
    marginBottom: 14,
  },
  sectionTitle: {
    marginTop: 4,
    fontSize: 21,
    fontWeight: "800",
    color: "#101828",
  },
  formSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#667085",
  },
  cancelText: {
    fontSize: 13,
    fontWeight: "800",
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
    minHeight: 50,
    marginBottom: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    fontSize: 15,
    color: "#101828",
  },
  classGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  classOption: {
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#FFFFFF",
  },
  classOptionSelected: {
    borderColor: "#0B63CE",
    backgroundColor: "#EAF2FF",
  },
  classOptionText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475467",
  },
  classOptionTextSelected: {
    color: "#0B63CE",
  },
  formError: {
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 19,
    color: "#B42318",
  },
  vehicleCard: {
    marginBottom: 14,
    padding: 18,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
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
    fontSize: 20,
    fontWeight: "800",
    color: "#101828",
  },
  vehicleType: {
    marginTop: 5,
    fontSize: 13,
    color: "#667085",
  },
  editButton: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: "#F2F4F7",
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#344054",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
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
    fontWeight: "800",
    color: "#344054",
  },
  divider: {
    height: 1,
    marginVertical: 15,
    backgroundColor: "#EAECF0",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 9,
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
    fontWeight: "700",
    color: "#344054",
  },
  infoBox: {
    marginTop: 7,
    padding: 13,
    borderRadius: 11,
    backgroundColor: "#FFFAEB",
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#7A2E0E",
  },
  infoText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: "#93370D",
  },
  emptyCard: {
    alignItems: "center",
    padding: 24,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#101828",
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
    marginTop: 28,
  },
  footerBrand: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
    color: "#98A2B3",
  },
  footerText: {
    marginTop: 5,
    fontSize: 12,
    color: "#98A2B3",
  },
});
