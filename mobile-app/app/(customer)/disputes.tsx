import { useMemo, useState } from "react";
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
      <Text style={styles.eyebrow}>DISPUTE MANAGEMENT</Text>
      <Text style={styles.title}>Disputes</Text>
      <Text style={styles.subtitle}>
        Report an issue with a shipment and track its review status.
      </Text>

      <View style={styles.card}>
        <Text style={styles.heading}>Open a Dispute</Text>
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
              <Text style={styles.route}>{route(booking)}</Text>
              <Text style={styles.meta}>
                {booking.truckCategory} · {fmtStatus(booking.status)}
              </Text>
            </Pressable>
          ))
        )}

        {selected && (
          <View style={styles.pickup}>
            <Text style={styles.pickupTitle}>Pickup details</Text>
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

        <Text style={styles.label}>REASON</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Describe the issue or dispute"
          multiline
          textAlignVertical="top"
          style={styles.input}
        />

        <Text style={styles.label}>EVIDENCE</Text>

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
            <Text style={styles.submitText}>Submit Dispute</Text>
          )}
        </Pressable>
      </View>

      <Text style={[styles.heading, styles.history]}>My Disputes</Text>

      {disputes.data?.map((dispute: Dispute) => {
        const booking = bookings.data?.find(
          (b) => b.id === dispute.bookingId,
        );

        return (
          <View key={dispute.id} style={styles.dispute}>
            <View style={styles.row}>
              <Text style={styles.route}>
                {booking ? route(booking) : "Shipment"}
              </Text>
              <Text style={styles.status}>
                {fmtStatus(dispute.status)}
              </Text>
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
    paddingBottom: 40,
    backgroundColor: "#F8FAFC",
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0B63CE",
  },
  title: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: "900",
    color: "#101828",
  },
  subtitle: {
    marginVertical: 12,
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
  },
  card: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
  },
  heading: {
    fontSize: 18,
    fontWeight: "800",
    color: "#101828",
  },
  label: {
    marginTop: 16,
    marginBottom: 7,
    fontSize: 11,
    fontWeight: "800",
    color: "#667085",
  },
  booking: {
    padding: 13,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D0D5DD",
  },
  selected: {
    borderColor: "#0B63CE",
    backgroundColor: "#EAF2FF",
  },
  route: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    color: "#101828",
  },
  meta: {
    marginTop: 5,
    fontSize: 11,
    color: "#667085",
  },
  pickup: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
  },
  pickupTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#101828",
  },
  pickupText: {
    marginTop: 5,
    fontSize: 12,
    color: "#344054",
  },
  coords: {
    marginTop: 4,
    fontSize: 10,
    color: "#667085",
  },
  input: {
    minHeight: 110,
    padding: 12,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 10,
    color: "#101828",
  },
  submit: {
    minHeight: 50,
    marginTop: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#0B63CE",
  },
  submitText: {
    color: "#FFF",
    fontWeight: "800",
  },
  history: {
    marginTop: 28,
    marginBottom: 12,
  },
  dispute: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  status: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0B63CE",
  },
  reason: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: "#475467",
  },
  evidence: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "800",
    color: "#0B63CE",
  },
  date: {
    marginTop: 8,
    fontSize: 11,
    color: "#98A2B3",
  },
});
