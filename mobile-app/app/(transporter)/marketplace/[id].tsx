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
  const { id } = useLocalSearchParams<{ id: string }>();
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
    queryKey: ["transporter-marketplace", "detail", id],
    queryFn: async () => {
      const loads = await getMarketplaceLoads();
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
      (vehicle.vehicleType === load.truckCategory ||
        vehicle.vehicleClass === load.truckCategory),
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

        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="Enter amount"
          placeholderTextColor="#98A2B3"
          keyboardType="decimal-pad"
          style={styles.input}
        />

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
    padding: 20,
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
  },
  backButton: {
    marginBottom: 24,
  },
  backText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0B63CE",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#0B63CE",
  },
  title: {
    marginTop: 5,
    marginBottom: 18,
    fontSize: 30,
    fontWeight: "800",
    color: "#101828",
  },
  routeCard: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: "#101828",
    marginBottom: 14,
  },
  location: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  arrow: {
    marginVertical: 5,
    fontSize: 18,
    color: "#98A2B3",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E4E7EC",
  },
  sectionTitle: {
    marginBottom: 18,
    fontSize: 19,
    fontWeight: "800",
    color: "#101828",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#98A2B3",
  },
  detailValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "700",
    color: "#344054",
  },
  descriptionBox: {
    marginTop: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#EAECF0",
  },
  description: {
    marginTop: 7,
    fontSize: 14,
    lineHeight: 21,
    color: "#475467",
  },
  inputLabel: {
    marginTop: 6,
    marginBottom: 7,
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
  },
  noVehicleText: {
    color: "#B42318",
    lineHeight: 20,
    fontSize: 14,
  },
  vehicleOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
  },
  vehicleOptionSelected: {
    borderColor: "#0B63CE",
    backgroundColor: "#EFF8FF",
  },
  vehicleInfo: {
    flex: 1,
    paddingRight: 12,
  },
  vehicleRegistration: {
    fontSize: 15,
    fontWeight: "800",
    color: "#101828",
  },
  vehicleDetails: {
    marginTop: 4,
    fontSize: 12,
    color: "#667085",
  },
  vehicleRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#98A2B3",
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleRadioSelected: {
    borderColor: "#0B63CE",
  },
  vehicleRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#0B63CE",
  },
  negotiatedCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#D0D5DD",
  },
  negotiatedLabel: {
    color: "#667085",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  negotiatedTitle: {
    color: "#101828",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 7,
  },
  negotiatedText: {
    color: "#475467",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 7,
  },
  commissionNotice: {
    backgroundColor: "#FFF7E8",
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  commissionNoticeText: {
    color: "#7A4E00",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  bidSectionTitle: {
    marginTop: 10,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#101828",
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  messageInput: {
    minHeight: 100,
    paddingTop: 14,
  },
  submitButton: {
    minHeight: 50,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B63CE",
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  button: {
    marginTop: 16,
    borderRadius: 13,
    paddingHorizontal: 20,
    paddingVertical: 13,
    backgroundColor: "#101828",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  errorTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#101828",
  },
  errorText: {
    marginTop: 8,
    textAlign: "center",
    lineHeight: 21,
    color: "#B42318",
  },
});
