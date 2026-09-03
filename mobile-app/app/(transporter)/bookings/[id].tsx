import { useEffect, useMemo, useState } from "react";
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
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getBooking,
  updateBookingStatus,
  uploadProofOfDelivery,
} from "../../../src/api/bookings";
import {
  getBookingMessages,
  sendBookingMessage,
  type Message,
} from "../../../src/api/messages";
import { useAuthStore } from "../../../src/auth/auth.store";
import {
  joinBookingRealtime,
  type BookingRealtimeEvent,
  type VehicleLocation,
} from "../../../src/realtime/booking-realtime";
import {
  startTransporterLocationTracking,
  stopTransporterLocationTracking,
} from "../../../src/realtime/location-publisher";
import BookingReviewForm from "../../../src/components/BookingReviewForm";

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function statusDescription(status: string) {
  switch (status) {
    case "ASSIGNED":
      return "A shipment has been assigned to you. Review the details and accept the assignment.";
    case "ACCEPTED":
      return "Assignment accepted. You can now begin travelling toward the pickup location.";
    case "DRIVER_ARRIVING":
      return "You are on the way to the pickup location.";
    case "ARRIVED":
      return "You have arrived. Complete the pickup and submit proof of delivery when required.";
    case "IN_TRANSIT":
      return "Shipment is currently in transit.";
    case "COMPLETED":
      return "Delivery has been confirmed successfully.";
    case "CANCELLED":
      return "This assignment has been cancelled.";
    default:
      return "Review the current shipment status.";
  }
}

function nextAction(status: string) {
  switch (status) {
    case "ASSIGNED":
      return {
        status: "ACCEPTED" as const,
        label: "Accept Assignment",
      };
    case "ACCEPTED":
      return {
        status: "DRIVER_ARRIVING" as const,
        label: "Start Journey",
      };
    case "DRIVER_ARRIVING":
      return {
        status: "ARRIVED" as const,
        label: "Mark Arrived",
      };
    case "ARRIVED":
      return {
        status: "IN_TRANSIT" as const,
        label: "Start Delivery",
      };
    default:
      return null;
  }
}

export default function TransporterBookingDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);

  const [liveEvent, setLiveEvent] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [vehicleLocation, setVehicleLocation] =
    useState<VehicleLocation | null>(null);

  const [proof, setProof] = useState("");

  const query = useQuery({
    queryKey: ["transporter-booking", id],
    queryFn: () => getBooking(id),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (!id) return;

    let cleanup: (() => void) | undefined;

    void joinBookingRealtime(id, {
      onBookingActivity: (event: BookingRealtimeEvent) => {
        setLiveEvent(event.eventType);
        void query.refetch();
      },
      onVehicleLocation: setVehicleLocation,
      onAccessDenied: (message) => {
        Alert.alert("Realtime access", message);
      },
    })
      .then((unsubscribe) => {
        cleanup = unsubscribe;
      })
      .catch(() => {
        // REST remains available if realtime is unavailable.
      });

    return () => cleanup?.();
  }, [id, query.refetch]);

  const messagesQuery = useQuery({
    queryKey: ["transporter-booking-messages", id],
    queryFn: () => getBookingMessages(id!),
    enabled: Boolean(id),
    refetchInterval: 5000,
  });

  const messageMutation = useMutation({
    mutationFn: () =>
      sendBookingMessage({
        bookingId: id!,
        recipientId: query.data!.customerId,
        content: messageText.trim(),
      }),
    onSuccess: async () => {
      setMessageText("");
      await messagesQuery.refetch();
    },
    onError: (error: unknown) => {
      Alert.alert(
        "Message failed",
        error instanceof Error
          ? error.message
          : "Unable to send message.",
      );
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (
      status: Parameters<typeof updateBookingStatus>[1],
    ) => {
      const updatedBooking = await updateBookingStatus(id!, status);

      if (status === "IN_TRANSIT") {
        await startTransporterLocationTracking(id!);
      }

      if (status === "CANCELLED") {
        await stopTransporterLocationTracking();
      }

      return updatedBooking;
    },
    onSuccess: async () => {
      await query.refetch();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to update shipment status.";

      Alert.alert("Status update failed", message);
    },
  });

  const proofMutation = useMutation({
    mutationFn: () =>
      uploadProofOfDelivery(
        id!,
        proof.trim(),
      ),
    onSuccess: async (updatedBooking) => {
      setProof("");

      if (
        updatedBooking.status === "COMPLETED" ||
        updatedBooking.status === "CANCELLED"
      ) {
        await stopTransporterLocationTracking();
      }

      await query.refetch();

      Alert.alert(
        "Proof submitted",
        "Proof of delivery has been recorded successfully. The customer must confirm the delivery to complete the shipment.",
      );
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to submit proof of delivery.";

      Alert.alert("Submission failed", message);
    },
  });

  const action = useMemo(
    () => nextAction(query.data?.status ?? ""),
    [query.data?.status],
  );

  if (query.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading assignment...</Text>
      </View>
    );
  }

  if (query.isError || !query.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Assignment unavailable</Text>
        <Text style={styles.errorText}>
          The shipment could not be loaded.
        </Text>

        <Pressable onPress={() => router.back()} style={styles.button}>
          <Text style={styles.buttonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const booking = query.data;

  const canCancel = [
    "ASSIGNED",
    "ACCEPTED",
    "DRIVER_ARRIVING",
    "ARRIVED",
    "IN_TRANSIT",
  ].includes(booking.status);

  const canSubmitProof = booking.status === "ARRIVED";

  const sendMessage = () => {
    if (!messageText.trim()) {
      Alert.alert("Message required", "Enter a message before sending.");
      return;
    }

    if (!user?.id) {
      Alert.alert("Session unavailable", "Please sign in again.");
      return;
    }

    messageMutation.mutate();
  };

  const submitProof = () => {
    if (!proof.trim()) {
      Alert.alert("Proof required", "Enter the proof of delivery.");
      return;
    }

    proofMutation.mutate();
  };

  const confirmStatusChange = (
    status: Parameters<typeof updateBookingStatus>[1],
    label: string,
  ) => {
    Alert.alert(
      label,
      `Confirm that you want to change this shipment to ${formatStatus(
        status,
      )}?`,
      [
        { text: "Not Now", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => statusMutation.mutate(status),
        },
      ],
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ Back to Assignments</Text>
      </Pressable>

      <Text style={styles.eyebrow}>ASSIGNMENT</Text>
      <Text style={styles.title}>Shipment Details</Text>

      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusLabel}>CURRENT STATUS</Text>
        </View>

        <Text style={styles.status}>
          {formatStatus(booking.status)}
        </Text>

        <Text style={styles.statusDescription}>
          {statusDescription(booking.status)}
        </Text>

        {liveEvent && (
          <Text style={styles.live}>
            Live update received: {formatStatus(liveEvent)}
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>ROUTE</Text>

        <View style={styles.routeRow}>
          <View style={styles.pickupDot} />
          <View style={styles.routeContent}>
            <Text style={styles.routeLabel}>PICKUP</Text>
            <Text style={styles.location}>
              {booking.pickupLocation}
            </Text>
          </View>
        </View>

        <View style={styles.routeConnector} />

        <View style={styles.routeRow}>
          <View style={styles.destinationDot} />
          <View style={styles.routeContent}>
            <Text style={styles.routeLabel}>DESTINATION</Text>
            <Text style={styles.location}>
              {booking.destination}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>SHIPMENT INFORMATION</Text>

        <InfoRow
          label="Truck category"
          value={booking.truckCategory.replace(/_/g, " ")}
        />

        <InfoRow
          label="Cargo category"
          value={booking.cargoCategory?.replace(/_/g, " ") ?? "—"}
        />

        <InfoRow
          label="Cargo weight"
          value={booking.cargoWeight ?? "—"}
        />

        <InfoRow
          label="Fare"
          value={booking.fare ?? booking.estimatedFare ?? "Pending"}
        />

        <InfoRow
          label="Payment"
          value={booking.paymentStatus}
        />

        <InfoRow
          label="Shipment ID"
          value={booking.id}
        />
      </View>

      {vehicleLocation && (
        <View style={styles.liveCard}>
          <Text style={styles.sectionLabel}>LIVE VEHICLE LOCATION</Text>

          <Text style={styles.locationValue}>
            {vehicleLocation.latitude.toFixed(6)},{" "}
            {vehicleLocation.longitude.toFixed(6)}
          </Text>

          {vehicleLocation.speed != null && (
            <Text style={styles.locationMeta}>
              Speed: {vehicleLocation.speed}
            </Text>
          )}
        </View>
      )}

      {action && (
        <View style={styles.actionCard}>
          <Text style={styles.sectionLabel}>NEXT ACTION</Text>

          <Text style={styles.actionTitle}>{action.label}</Text>

          <Text style={styles.actionText}>
            Update the shipment status after completing this operational
            step.
          </Text>

          <Pressable
            disabled={statusMutation.isPending}
            onPress={() =>
              confirmStatusChange(action.status, action.label)
            }
            style={[
              styles.primaryButton,
              statusMutation.isPending && styles.disabled,
            ]}
          >
            {statusMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {action.label}
              </Text>
            )}
          </Pressable>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>CUSTOMER COMMUNICATION</Text>

        {messagesQuery.isLoading ? (
          <View style={styles.messageLoading}>
            <ActivityIndicator />
            <Text style={styles.messageMuted}>Loading messages...</Text>
          </View>
        ) : messagesQuery.isError ? (
          <View>
            <Text style={styles.messageError}>
              Unable to load conversation.
            </Text>
            <Pressable
              onPress={() => messagesQuery.refetch()}
              style={styles.smallButton}
            >
              <Text style={styles.smallButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.messageList}>
            {(messagesQuery.data ?? []).length === 0 ? (
              <Text style={styles.messageMuted}>
                No messages yet. Contact the customer about this assignment.
              </Text>
            ) : (
              (messagesQuery.data ?? []).map((message: Message) => (
                <View
                  key={message.id}
                  style={[
                    styles.messageBubble,
                    message.senderId === user?.id
                      ? styles.myMessage
                      : styles.customerMessage,
                  ]}
                >
                  <Text style={styles.messageSender}>
                    {message.senderId === user?.id ? "You" : "Customer"}
                  </Text>
                  <Text style={styles.messageContent}>
                    {message.content}
                  </Text>
                  <Text style={styles.messageDate}>
                    {new Date(message.createdAt).toLocaleString()}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        <TextInput
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Write a message to the customer..."
          placeholderTextColor="#98A2B3"
          multiline
          style={[styles.input, styles.multiline]}
        />

        <Pressable
          disabled={messageMutation.isPending}
          onPress={sendMessage}
          style={[
            styles.primaryButton,
            messageMutation.isPending && styles.disabled,
          ]}
        >
          {messageMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Send Message</Text>
          )}
        </Pressable>
      </View>

      {canSubmitProof && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>PROOF OF DELIVERY</Text>

          <Text style={styles.formLabel}>Proof</Text>
          <TextInput
            value={proof}
            onChangeText={setProof}
            placeholder="Enter proof of delivery"
            placeholderTextColor="#98A2B3"
            multiline
            style={[styles.input, styles.multiline]}
          />

          <Pressable
            disabled={proofMutation.isPending}
            onPress={submitProof}
            style={[
              styles.primaryButton,
              proofMutation.isPending && styles.disabled,
            ]}
          >
            {proofMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                Submit Proof of Delivery
              </Text>
            )}
          </Pressable>
        </View>
      )}

      {canCancel && (
        <Pressable
          disabled={statusMutation.isPending}
          onPress={() =>
            confirmStatusChange("CANCELLED", "Cancel Assignment")
          }
          style={styles.cancelButton}
        >
          <Text style={styles.cancelText}>Cancel Assignment</Text>
        </Pressable>
      )}

      {booking.status === "COMPLETED" && (
        <BookingReviewForm
          bookingId={booking.id}
          title="RATE CUSTOMER"
          revieweeLabel="customer"
        />
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

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 48,
    paddingBottom: 50,
    backgroundColor: "#F5F7FA",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: "#667085",
  },
  back: {
    color: "#175CD3",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 28,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.6,
    color: "#0B63CE",
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#101828",
    marginTop: 5,
    marginBottom: 18,
  },
  statusCard: {
    backgroundColor: "#101828",
    borderRadius: 20,
    padding: 22,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#12B76A",
    marginRight: 8,
  },
  statusLabel: {
    color: "#98A2B3",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
  },
  status: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "800",
    marginTop: 8,
  },
  statusDescription: {
    color: "#D0D5DD",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 9,
  },
  live: {
    color: "#A4F4C5",
    fontSize: 12,
    marginTop: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#EAECF0",
  },
  sectionLabel: {
    color: "#667085",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
    marginBottom: 15,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  pickupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#0B63CE",
    marginTop: 4,
    marginRight: 12,
  },
  destinationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#101828",
    marginTop: 4,
    marginRight: 12,
  },
  routeContent: {
    flex: 1,
  },
  routeLabel: {
    color: "#98A2B3",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  location: {
    color: "#1D2939",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 5,
  },
  routeConnector: {
    height: 22,
    width: 1,
    backgroundColor: "#D0D5DD",
    marginLeft: 4,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F4F7",
  },
  infoLabel: {
    flex: 1,
    color: "#667085",
    fontSize: 13,
  },
  infoValue: {
    flex: 1.2,
    color: "#1D2939",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },
  liveCard: {
    backgroundColor: "#EEF6FF",
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
  },
  locationValue: {
    color: "#175CD3",
    fontSize: 17,
    fontWeight: "800",
  },
  locationMeta: {
    color: "#667085",
    marginTop: 7,
    fontSize: 13,
  },
  actionCard: {
    backgroundColor: "#EAF2FF",
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
  },
  actionTitle: {
    color: "#101828",
    fontSize: 20,
    fontWeight: "800",
  },
  actionText: {
    color: "#475467",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 16,
  },
  formLabel: {
    color: "#344054",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 6,
    marginBottom: 7,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#101828",
    marginBottom: 12,
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#0B63CE",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 4,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.6,
  },
  cancelButton: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDA29B",
    backgroundColor: "#FEF3F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  cancelText: {
    color: "#B42318",
    fontSize: 14,
    fontWeight: "800",
  },
  button: {
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
    marginTop: 16,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  errorTitle: {
    color: "#101828",
    fontSize: 19,
    fontWeight: "800",
  },
  errorText: {
    color: "#667085",
    marginTop: 7,
  },
  footer: {
    alignItems: "center",
    marginTop: 12,
  },
  messageLoading: {
    alignItems: "center",
    paddingVertical: 12,
  },
  messageMuted: {
    marginTop: 8,
    color: "#667085",
    lineHeight: 20,
  },
  messageError: {
    color: "#B42318",
    fontWeight: "700",
    marginBottom: 10,
  },
  smallButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: "#F2F4F7",
  },
  smallButtonText: {
    color: "#344054",
    fontWeight: "700",
  },
  messageList: {
    gap: 10,
    marginBottom: 14,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 14,
    maxWidth: "88%",
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#E8F1FF",
  },
  customerMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#F2F4F7",
  },
  messageSender: {
    fontSize: 11,
    fontWeight: "800",
    color: "#667085",
    marginBottom: 4,
  },
  messageContent: {
    fontSize: 14,
    lineHeight: 20,
    color: "#101828",
  },
  messageDate: {
    marginTop: 5,
    fontSize: 10,
    color: "#98A2B3",
  },
  footerBrand: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    color: "#98A2B3",
  },
  footerText: {
    fontSize: 11,
    color: "#98A2B3",
    marginTop: 5,
  },
});
