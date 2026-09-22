import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getMarketplaceLoads,
  getTransporterVehicles,
  submitMarketplaceBid,
} from "../../../src/api/transporter";
import { useAuthStore } from "../../../src/auth/auth.store";

function formatDate(value?: string | null) {
  if (!value) return "Schedule not specified";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Schedule not specified";
  }

  return date.toLocaleDateString();
}

export default function MarketplaceOpportunity() {
  const { id, radiusKm } = useLocalSearchParams<{
    id: string;
    radiusKm?: string;
  }>();

  const parsedRadiusKm =
    typeof radiusKm === "string" ? Number(radiusKm) : undefined;

  const effectiveRadiusKm =
    parsedRadiusKm !== undefined &&
    Number.isFinite(parsedRadiusKm) &&
    parsedRadiusKm > 0
      ? parsedRadiusKm
      : undefined;
  const user = useAuthStore((state) => state.user);

  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

  const vehiclesQuery = useQuery({
    queryKey: ["transporter-vehicles", user?.id],
    queryFn: () => getTransporterVehicles(user!.id),
    enabled: Boolean(user?.id),
  });

  const query = useQuery({
    queryKey: [
      "transporter-marketplace",
      "detail",
      id,
      effectiveRadiusKm,
    ],
    queryFn: async () => {
      const loads = await getMarketplaceLoads(effectiveRadiusKm);
      return loads.find((load) => load.id === id) ?? null;
    },
    enabled: Boolean(id),
  });

  const bidMutation = useMutation({
    mutationFn: () =>
      submitMarketplaceBid(id!, {
        vehicleId: selectedVehicleId,
        amount: Number(amount),
        message: message.trim() || undefined,
        radiusKm: effectiveRadiusKm,
      }),
    onSuccess: () => {
      router.back();
    },
  });

  if (query.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading opportunity...</Text>
      </View>
    );
  }

  const load = query.data;

  if (!load) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Opportunity unavailable</Text>
        <Text style={styles.errorText}>
          This opportunity may no longer be visible to your transporter
          account.
        </Text>

        <Pressable onPress={() => router.back()} style={styles.button}>
          <Text style={styles.buttonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const eligibleVehicles = (vehiclesQuery.data ?? []).filter(
    (vehicle) =>
      vehicle.verificationStatus === "APPROVED" &&
      vehicle.availabilityStatus === "AVAILABLE" &&
      vehicle.vehicleClass === load.truckCategory,
  );

  const canSubmit =
    selectedVehicleId.length > 0 &&
    amount.trim().length > 0 &&
    Number.isFinite(Number(amount)) &&
    Number(amount) > 0 &&
    !bidMutation.isPending;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back to Exchange</Text>
      </Pressable>

      <Text style={styles.eyebrow}>TRANSPORT OPPORTUNITY</Text>

      <Text style={styles.title}>Capacity Exchange</Text>

      <View style={styles.routeCard}>
        <Text style={styles.location}>{load.pickupLocation}</Text>
        <Text style={styles.arrow}>↓</Text>
        <Text style={styles.location}>{load.destination}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Shipment requirements</Text>

        <Detail label="Truck category" value={load.truckCategory} />
        <Detail
          label="Cargo category"
          value={load.cargoCategory ?? "GENERAL"}
        />
        <Detail label="Cargo weight" value={String(load.cargoWeight)} />
        <Detail label="Scheduled date" value={formatDate(load.scheduledDate)} />

        {load.cargoDescription ? (
          <View style={styles.descriptionBox}>
            <Text style={styles.detailLabel}>CARGO DESCRIPTION</Text>
            <Text style={styles.description}>{load.cargoDescription}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Select your vehicle</Text>

        {vehiclesQuery.isLoading ? (
          <View style={styles.vehicleLoading}>
            <ActivityIndicator size="small" />
            <Text style={styles.vehicleLoadingText}>
              Loading available vehicles...
            </Text>
          </View>
        ) : eligibleVehicles.length === 0 ? (
          <Text style={styles.noVehicleText}>
            You have no approved and available vehicle matching this truck
            category.
          </Text>
        ) : (
          eligibleVehicles.map((vehicle) => {
            const selected = selectedVehicleId === vehicle.id;

            return (
              <Pressable
                key={vehicle.id}
                onPress={() => setSelectedVehicleId(vehicle.id)}
                style={[
                  styles.vehicleOption,
                  selected && styles.vehicleOptionSelected,
                ]}
              >
                <View style={styles.vehicleInfo}>
                  <Text style={styles.vehicleRegistration}>
                    {vehicle.registrationNumber}
                  </Text>
                  <Text style={styles.vehicleDetails}>
                    {vehicle.make ?? ""} {vehicle.model ?? ""}
                    {vehicle.make || vehicle.model ? " • " : ""}
                    {vehicle.vehicleType}
                  </Text>
                </View>

                <View
                  style={[
                    styles.vehicleRadio,
                    selected && styles.vehicleRadioSelected,
                  ]}
                >
                  {selected ? <View style={styles.vehicleRadioDot} /> : null}
                </View>
              </Pressable>
            );
          })
        )}

        <Text style={[styles.sectionTitle, styles.bidSectionTitle]}>
          Submit a bid
        </Text>

        <View style={styles.negotiatedCard}>
          <Text style={styles.negotiatedLabel}>NEGOTIATED FARE</Text>
          <Text style={styles.negotiatedTitle}>
            Customer and transporter agree the fare directly
          </Text>
          <Text style={styles.negotiatedText}>
            Your bid is the transport fare you are proposing to the customer.
            If your bid is accepted, the customer pays the agreed fare directly
            to you. TransConet does not collect the negotiated fare from the
            customer.
          </Text>
          <View style={styles.commissionNotice}>
            <Text style={styles.commissionNoticeText}>
              A separate TransConet platform commission will become payable by
              you when your bid is selected.
            </Text>
          </View>
        </View>

        <Text style={styles.inputLabel}>YOUR BID AMOUNT</Text>

        <View style={styles.currencyInput}>
          <Text style={styles.currencyPrefix}>₦</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="Enter amount"
            placeholderTextColor="#98A2B3"
            keyboardType="decimal-pad"
            style={styles.currencyInputField}
          />
        </View>

        <Text style={styles.inputLabel}>MESSAGE (OPTIONAL)</Text>

        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Add a message for the customer"
          placeholderTextColor="#98A2B3"
          multiline
          textAlignVertical="top"
          style={[styles.input, styles.messageInput]}
        />

        {bidMutation.isError ? (
          <Text style={styles.errorText}>
            Unable to submit this bid. The opportunity or vehicle may no longer
            be available.
          </Text>
        ) : null}

        <Pressable
          disabled={!canSubmit}
          onPress={() => bidMutation.mutate()}
          style={[
            styles.submitButton,
            !canSubmit && styles.submitButtonDisabled,
          ]}
        >
          {bidMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>Submit Bid</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
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
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 44,
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
    marginTop: 14,
    color: "#667085",
    fontSize: 14,
    fontWeight: "600",
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 22,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "#E9EEFF",
    borderWidth: 1,
    borderColor: "#D9E2FF",
  },
  backText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#4169E1",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.6,
    color: "#4169E1",
  },
  title: {
    marginTop: 5,
    marginBottom: 17,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: "900",
    color: "#101B3A",
  },
  routeCard: {
    padding: 20,
    borderRadius: 22,
    backgroundColor: "#101B3A",
    marginBottom: 16,
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 5,
  },
  location: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  arrow: {
    alignSelf: "center",
    marginVertical: 5,
    fontSize: 21,
    fontWeight: "800",
    color: "#8EA8FF",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#E1E7F5",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionTitle: {
    marginBottom: 15,
    fontSize: 19,
    fontWeight: "900",
    color: "#101B3A",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F7",
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#98A2B3",
  },
  detailValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "800",
    color: "#344054",
  },
  descriptionBox: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#F7F9FF",
    borderWidth: 1,
    borderColor: "#E1E7F5",
  },
  description: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 20,
    color: "#475467",
  },
  inputLabel: {
    marginTop: 7,
    marginBottom: 8,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#667085",
  },
  vehicleLoading: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  vehicleLoadingText: {
    marginLeft: 10,
    color: "#667085",
    fontSize: 13,
    fontWeight: "600",
  },
  noVehicleText: {
    padding: 13,
    borderRadius: 12,
    backgroundColor: "#FFF4F2",
    color: "#B42318",
    lineHeight: 20,
    fontSize: 13,
    fontWeight: "600",
  },
  vehicleOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#DCE2F0",
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
  },
  vehicleOptionSelected: {
    borderColor: "#4169E1",
    backgroundColor: "#EEF2FF",
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 7,
    elevation: 2,
  },
  vehicleInfo: {
    flex: 1,
    paddingRight: 12,
  },
  vehicleRegistration: {
    fontSize: 15,
    fontWeight: "900",
    color: "#101B3A",
  },
  vehicleDetails: {
    marginTop: 4,
    fontSize: 12,
    color: "#667085",
    fontWeight: "600",
  },
  vehicleRadio: {
    width: 23,
    height: 23,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#AAB3C5",
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleRadioSelected: {
    borderColor: "#4169E1",
  },
  vehicleRadioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#4169E1",
  },
  negotiatedCard: {
    backgroundColor: "#F7F9FF",
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    marginBottom: 17,
    borderWidth: 1,
    borderColor: "#DCE4F8",
  },
  negotiatedLabel: {
    color: "#4169E1",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
  },
  negotiatedTitle: {
    color: "#101B3A",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    marginTop: 7,
  },
  negotiatedText: {
    color: "#475467",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
  },
  commissionNotice: {
    backgroundColor: "#FFF7E8",
    borderRadius: 11,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#F4DEAD",
  },
  commissionNoticeText: {
    color: "#7A4E00",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  bidSectionTitle: {
    marginTop: 11,
  },
  input: {
    minHeight: 51,
    borderWidth: 1,
    borderColor: "#D5DCEB",
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#101B3A",
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  currencyInput: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 51,
    borderWidth: 1,
    borderColor: "#D5DCEB",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  currencyPrefix: {
    paddingLeft: 15,
    fontSize: 16,
    color: "#4169E1",
    fontWeight: "900",
  },
  currencyInputField: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 16,
    fontWeight: "700",
    color: "#101B3A",
  },
  messageInput: {
    minHeight: 105,
    paddingTop: 14,
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4169E1",
    marginTop: 8,
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 9,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  button: {
    marginTop: 17,
    borderRadius: 14,
    paddingHorizontal: 21,
    paddingVertical: 13,
    backgroundColor: "#4169E1",
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 7,
    elevation: 3,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#101B3A",
    textAlign: "center",
  },
  errorText: {
    marginTop: 9,
    textAlign: "center",
    lineHeight: 21,
    color: "#B42318",
    fontSize: 13,
  },
});
