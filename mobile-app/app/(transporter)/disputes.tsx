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
import {
  getTransporterBookings,
  type Booking,
} from "../../src/api/bookings";
import {
  createTransporterDispute,
  getTransporterDisputes,
  type TransporterDispute,
} from "../../src/api/transporter";
import { useAuthStore } from "../../src/auth/auth.store";

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function bookingLabel(booking: Booking) {
  return `${booking.pickupLocation} → ${booking.destination}`;
}

export default function TransporterDisputes() {
  const user = useAuthStore((state) => state.user);

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    null,
  );
  const [reason, setReason] = useState("");

  const bookingsQuery = useQuery({
    queryKey: ["transporter-dispute-bookings", user?.id],
    queryFn: () => getTransporterBookings(user!.id),
    enabled: Boolean(user?.id),
  });

  const disputesQuery = useQuery({
    queryKey: ["transporter-disputes", user?.id],
    queryFn: () => getTransporterDisputes(user!.id),
    enabled: Boolean(user?.id),
  });

  const availableBookings = useMemo(
    () => bookingsQuery.data ?? [],
    [bookingsQuery.data],
  );

  const bookingMap = useMemo(() => {
    return new Map(
      availableBookings.map((booking) => [booking.id, booking]),
    );
  }, [availableBookings]);

  const createMutation = useMutation({
    mutationFn: () =>
      createTransporterDispute({
        bookingId: selectedBookingId!,
        reason: reason.trim(),
      }),
    onSuccess: async () => {
      setSelectedBookingId(null);
      setReason("");
      await disputesQuery.refetch();

      Alert.alert(
        "Dispute submitted",
        "Your dispute has been submitted for administrator review.",
      );
    },
    onError: (error: unknown) => {
      Alert.alert(
        "Unable to submit dispute",
        error instanceof Error
          ? error.message
          : "Unable to create the dispute.",
      );
    },
  });

  const submit = () => {
    if (!user?.id) {
      Alert.alert("Session unavailable", "Please sign in again.");
      return;
    }

    if (!selectedBookingId) {
      Alert.alert(
        "Assignment required",
        "Select the assignment related to the dispute.",
      );
      return;
    }

    if (reason.trim().length < 1) {
      Alert.alert(
        "Reason required",
        "Please describe the reason for the dispute.",
      );
      return;
    }

    createMutation.mutate();
  };

  const refresh = async () => {
    await Promise.all([
      bookingsQuery.refetch(),
      disputesQuery.refetch(),
    ]);
  };

  const disputes = disputesQuery.data ?? [];

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={
            bookingsQuery.isFetching || disputesQuery.isFetching
          }
          onRefresh={() => void refresh()}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>DISPUTE MANAGEMENT</Text>
      <Text style={styles.title}>Disputes</Text>
      <Text style={styles.subtitle}>
        Report an issue related to an assignment and track its review status.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Open a Dispute</Text>

        <Text style={styles.label}>SELECT ASSIGNMENT</Text>

        {bookingsQuery.isLoading ? (
          <ActivityIndicator size="small" />
        ) : availableBookings.length === 0 ? (
          <Text style={styles.emptyInline}>
            No transporter assignments are available.
          </Text>
        ) : (
          <View style={styles.bookingList}>
            {availableBookings.map((booking) => (
              <Pressable
                key={booking.id}
                onPress={() => setSelectedBookingId(booking.id)}
                style={[
                  styles.bookingOption,
                  selectedBookingId === booking.id &&
                    styles.bookingOptionActive,
                ]}
              >
                <View style={styles.bookingTopRow}>
                  <Text style={styles.bookingRoute} numberOfLines={2}>
                    {bookingLabel(booking)}
                  </Text>
                  <Text style={styles.bookingStatus}>
                    {formatStatus(booking.status)}
                  </Text>
                </View>

                <Text style={styles.bookingMeta}>
                  {booking.truckCategory} · {booking.cargoWeight}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.label}>REASON</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Describe the issue or dispute"
          style={[styles.input, styles.textArea]}
          multiline
          textAlignVertical="top"
        />

        <Pressable
          onPress={submit}
          disabled={createMutation.isPending}
          style={[
            styles.submitButton,
            createMutation.isPending && styles.disabled,
          ]}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>Submit Dispute</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.historyHeader}>
        <Text style={styles.sectionTitle}>My Disputes</Text>
        <Text style={styles.count}>{disputes.length}</Text>
      </View>

      {disputesQuery.isLoading ? (
        <ActivityIndicator size="small" />
      ) : disputes.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No disputes</Text>
          <Text style={styles.emptyText}>
            Submitted disputes will appear here.
          </Text>
        </View>
      ) : (
        disputes.map((dispute: TransporterDispute) => {
          const booking = bookingMap.get(dispute.bookingId);

          return (
            <View key={dispute.id} style={styles.disputeCard}>
              <View style={styles.disputeHeader}>
                <Text style={styles.disputeTitle}>
                  {booking
                    ? bookingLabel(booking)
                    : `Assignment ${dispute.bookingId.slice(0, 8)}`}
                </Text>

                <Text style={styles.status}>
                  {formatStatus(dispute.status)}
                </Text>
              </View>

              <Text style={styles.reason}>{dispute.reason}</Text>

              {dispute.createdAt && (
                <Text style={styles.date}>
                  Submitted {formatDate(dispute.createdAt)}
                </Text>
              )}
            </View>
          );
        })
      )}
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
    letterSpacing: 1.2,
    color: "#0B63CE",
  },
  title: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: "900",
    color: "#101828",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 18,
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
  },
  card: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#101828",
  },
  label: {
    marginTop: 16,
    marginBottom: 7,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#667085",
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    fontSize: 14,
    color: "#101828",
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  },
  bookingList: {
    gap: 8,
  },
  bookingOption: {
    padding: 13,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#FFFFFF",
  },
  bookingOptionActive: {
    borderColor: "#0B63CE",
    backgroundColor: "#EAF2FF",
  },
  bookingTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  bookingRoute: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#101828",
  },
  bookingStatus: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0B63CE",
  },
  bookingMeta: {
    marginTop: 6,
    fontSize: 11,
    color: "#667085",
  },
  emptyInline: {
    fontSize: 13,
    color: "#667085",
  },
  submitButton: {
    minHeight: 50,
    marginTop: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#0B63CE",
  },
  submitText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  disabled: {
    opacity: 0.6,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 28,
    marginBottom: 12,
  },
  count: {
    minWidth: 26,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    textAlign: "center",
    overflow: "hidden",
    backgroundColor: "#EAF2FF",
    color: "#0B63CE",
    fontSize: 12,
    fontWeight: "800",
  },
  disputeCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
  },
  disputeHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  disputeTitle: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
    color: "#101828",
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
  date: {
    marginTop: 10,
    fontSize: 11,
    color: "#98A2B3",
  },
  emptyCard: {
    padding: 24,
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#101828",
  },
  emptyText: {
    marginTop: 5,
    textAlign: "center",
    fontSize: 13,
    color: "#667085",
  },
});
