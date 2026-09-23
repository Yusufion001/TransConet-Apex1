import { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getCustomerBookings, type Booking } from "../../src/api/bookings";
import {
  createCustomerDispute,
  getCustomerDisputes,
  uploadDisputeEvidence,
  type Dispute,
} from "../../src/api/disputes";
import DisputeEvidencePicker, {
  type DisputeAsset,
} from "../../src/components/DisputeEvidencePicker";
import { useAuthStore } from "../../src/auth/auth.store";

const fmtStatus = (value: string) => value.replace(/_/g, " ");
const fmtDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "";

const route = (booking: Booking) =>
  `${booking.pickupLocation} → ${booking.destination}`;

export default function CustomerDisputes() {
  const user = useAuthStore((s) => s.user);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [assets, setAssets] = useState<DisputeAsset[]>([]);

  const bookings = useQuery({
    queryKey: ["customer-dispute-bookings", user?.id],
    queryFn: () => getCustomerBookings(user!.id),
    enabled: !!user?.id,
  });

  const disputes = useQuery({
    queryKey: ["customer-disputes", user?.id],
    queryFn: () => getCustomerDisputes(user!.id),
    enabled: !!user?.id,
  });

  const selected = useMemo(
    () => bookings.data?.find((b) => b.id === bookingId),
    [bookings.data, bookingId],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!bookingId) throw new Error("Select a shipment.");

      const media = await uploadDisputeEvidence(bookingId, assets);

      return createCustomerDispute({
        bookingId,
        reason: reason.trim(),
        evidence: media.length ? { media } : undefined,
      });
    },
    onSuccess: async () => {
      setBookingId(null);
      setReason("");
      setAssets([]);
      await disputes.refetch();
      Alert.alert(
        "Dispute submitted",
        "Your dispute is under administrator review.",
      );
    },
    onError: (error: unknown) =>
      Alert.alert(
        "Unable to submit dispute",
        error instanceof Error
          ? error.message
          : "Unable to create the dispute.",
      ),
  });

  const submit = () => {
    if (!user?.id) return Alert.alert("Session unavailable");
    if (!bookingId)
      return Alert.alert("Shipment required", "Select a shipment.");
    if (!reason.trim())
      return Alert.alert("Reason required", "Describe the dispute.");

    mutation.mutate();
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={bookings.isFetching || disputes.isFetching}
          onRefresh={() =>
            void Promise.all([bookings.refetch(), disputes.refetch()])
          }
        />
      }
    >
      <View style={styles.headerRow}>
        <View style={styles.eyebrowPill}>
          <Ionicons name="shield-checkmark-outline" size={14} color="#4169E1" />
          <Text style={styles.eyebrow}>DISPUTE MANAGEMENT</Text>
        </View>
      </View>

      <Text style={styles.title}>Disputes</Text>
      <Text style={styles.subtitle}>
        Report an issue with a shipment and track its review status.
      </Text>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIcon}>
            <Ionicons name="flag-outline" size={20} color="#4169E1" />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.heading}>Open a Dispute</Text>
            <Text style={styles.cardSubtitle}>
              Tell us what happened and provide supporting evidence.
            </Text>
          </View>
        </View>

        <Text style={styles.label}>SELECT SHIPMENT</Text>

        {bookings.isLoading ? (
          <ActivityIndicator />
        ) : (
          bookings.data?.map((booking) => (
            <Pressable
              key={booking.id}
              onPress={() => {
                setBookingId(booking.id);
                setAssets([]);
              }}
              style={[
                styles.booking,
                bookingId === booking.id && styles.selected,
              ]}
            >
              <View style={styles.bookingTop}>
                <View style={styles.routeIcon}>
                  <Ionicons name="cube-outline" size={16} color="#4169E1" />
                </View>
                <View style={styles.bookingContent}>
                  <Text style={styles.route}>{route(booking)}</Text>
                  <Text style={styles.meta}>
                    {booking.truckCategory} · {fmtStatus(booking.status)}
                  </Text>
                </View>
                <Ionicons
                  name={
                    bookingId === booking.id
                      ? "checkmark-circle"
                      : "ellipse-outline"
                  }
                  size={21}
                  color={bookingId === booking.id ? "#4169E1" : "#98A2B3"}
                />
              </View>
            </Pressable>
          ))
        )}

        {selected && (
          <View style={styles.pickup}>
            <View style={styles.pickupHeader}>
              <Ionicons name="location-outline" size={17} color="#4169E1" />
              <Text style={styles.pickupTitle}>Pickup details</Text>
            </View>
            <Text style={styles.pickupText}>
              {selected.pickupLocation}
            </Text>
            <Text style={styles.coords}>
              {selected.pickupLatitude ?? "—"},{" "}
              {selected.pickupLongitude ?? "—"}
            </Text>
            <Text style={styles.coords}>
              Scheduled:{" "}
              {selected.scheduledDate
                ? fmtDate(selected.scheduledDate)
                : "Not scheduled"}
            </Text>
            <Text style={styles.coords}>
              Pickup:{" "}
              {selected.pickedUpAt
                ? fmtDate(selected.pickedUpAt)
                : "Not marked"}
            </Text>
          </View>
        )}

        <View style={styles.labelRow}>
          <Ionicons name="document-text-outline" size={14} color="#667085" />
          <Text style={styles.label}>REASON</Text>
        </View>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Describe the issue or dispute"
          multiline
          textAlignVertical="top"
          style={styles.input}
        />

        <View style={styles.labelRow}>
          <Ionicons name="images-outline" size={14} color="#667085" />
          <Text style={styles.label}>EVIDENCE</Text>
        </View>

        <DisputeEvidencePicker
          assets={assets}
          onChange={setAssets}
          disabled={mutation.isPending}
        />

        <Pressable
          onPress={submit}
          disabled={mutation.isPending}
          style={styles.submit}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="send-outline" size={18} color="#FFFFFF" />
              <Text style={styles.submitText}>Submit Dispute</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.historyHeader}>
        <View>
          <Text style={[styles.heading, styles.history]}>My Disputes</Text>
          <Text style={styles.historySubtitle}>
            Review the status of issues you have reported.
          </Text>
        </View>
        <View style={styles.historyIcon}>
          <Ionicons name="time-outline" size={18} color="#4169E1" />
        </View>
      </View>

      {disputes.data?.map((dispute: Dispute) => {
        const booking = bookings.data?.find(
          (b) => b.id === dispute.bookingId,
        );

        return (
          <View key={dispute.id} style={styles.dispute}>
            <View style={styles.row}>
              <View style={styles.historyRoute}>
                <View style={styles.routeIcon}>
                  <Ionicons name="cube-outline" size={15} color="#4169E1" />
                </View>
                <Text style={styles.route}>
                  {booking ? route(booking) : "Shipment"}
                </Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.status}>
                  {fmtStatus(dispute.status)}
                </Text>
              </View>
            </View>

            <Text style={styles.reason}>{dispute.reason}</Text>

            {dispute.evidence?.media?.length ? (
              <Text style={styles.evidence}>
                {dispute.evidence.media.length} evidence file
                {dispute.evidence.media.length === 1 ? "" : "s"} attached
              </Text>
            ) : null}

            <Text style={styles.date}>
              Submitted {fmtDate(dispute.createdAt)}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 22,
    paddingBottom: 48,
    backgroundColor: "#F4F7FF",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  eyebrowPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#D8E4FF",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
    color: "#4169E1",
  },
  title: {
    marginTop: 12,
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "900",
    color: "#101B3A",
  },
  subtitle: {
    marginTop: 7,
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
  },
  card: {
    padding: 20,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE5F5",
    shadowColor: "#101B3A",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#D8E4FF",
  },
  cardHeaderText: {
    flex: 1,
  },
  heading: {
    fontSize: 18,
    fontWeight: "900",
    color: "#101B3A",
  },
  cardSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: "#667085",
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 20,
    marginBottom: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
    color: "#667085",
  },
  booking: {
    padding: 14,
    marginBottom: 9,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#DCE5F5",
    backgroundColor: "#FFFFFF",
  },
  selected: {
    borderColor: "#4169E1",
    backgroundColor: "#EEF4FF",
  },
  bookingTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bookingContent: {
    flex: 1,
  },
  routeIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF4FF",
  },
  route: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    color: "#101B3A",
  },
  meta: {
    marginTop: 5,
    fontSize: 11,
    color: "#667085",
  },
  pickup: {
    marginTop: 5,
    padding: 15,
    borderRadius: 15,
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#D8E4FF",
  },
  pickupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  pickupTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#101B3A",
  },
  pickupText: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: "#344054",
  },
  coords: {
    marginTop: 5,
    fontSize: 10,
    lineHeight: 15,
    color: "#667085",
  },
  input: {
    minHeight: 120,
    padding: 14,
    borderWidth: 1,
    borderColor: "#DCE5F5",
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    color: "#101B3A",
    fontSize: 14,
    lineHeight: 21,
  },
  submit: {
    minHeight: 52,
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: 15,
    backgroundColor: "#4169E1",
    shadowColor: "#4169E1",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  historyHeader: {
    marginTop: 28,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  history: {
    marginTop: 0,
    marginBottom: 3,
  },
  historySubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: "#667085",
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#D8E4FF",
  },
  dispute: {
    padding: 17,
    marginBottom: 12,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE5F5",
    shadowColor: "#101B3A",
    shadowOpacity: 0.045,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  historyRoute: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#D8E4FF",
  },
  status: {
    fontSize: 9,
    fontWeight: "900",
    color: "#4169E1",
    textTransform: "uppercase",
  },
  reason: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 20,
    color: "#475467",
  },
  evidence: {
    marginTop: 10,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "800",
    color: "#4169E1",
  },
  date: {
    marginTop: 9,
    fontSize: 11,
    color: "#98A2B3",
  },
});
