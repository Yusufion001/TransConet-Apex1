import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Share,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  getBooking,
  getBookingTrackingShare,
} from "../../../src/api/bookings";
import { apiClient } from "../../../src/api/client";
import {
  getBookingMessages,
  sendBookingMessage,
  type Message,
} from "../../../src/api/messages";
import {
  getBookingPayments,
  initializePayment,
  type Payment,
} from "../../../src/api/payments";
import {
  joinBookingRealtime,
  type BookingRealtimeEvent,
  type VehicleLocation,
} from "../../../src/realtime/booking-realtime";
import BookingReviewForm from "../../../src/components/BookingReviewForm";
import TransConetMap, {
  type MapCoordinate,
} from "../../../src/components/maps/TransConetMap";

export default function BookingDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [vehicleLocation, setVehicleLocation] =
    useState<VehicleLocation | null>(null);
  const [trackingRegion, setTrackingRegion] = useState({
    latitude: 6.5244,
    longitude: 3.3792,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [messageLoading, setMessageLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  const handleShareTracking = useCallback(async () => {
    if (!id || shareLoading) {
      return;
    }

    try {
      setShareLoading(true);

      const result = await getBookingTrackingShare(String(id));
      const baseUrl = String(
        apiClient.defaults.baseURL ?? "",
      ).replace(/\/$/, "");

      if (!baseUrl) {
        throw new Error("Tracking link is not configured");
      }

      const trackingUrl = `${baseUrl}/tracking/${result.trackingShareToken}`;

      await Share.share({
        title: "TransConet Live Tracking",
        message:
          `Track this TransConet shipment live:\n${trackingUrl}`,
        url: trackingUrl,
      });
    } catch (error) {
      Alert.alert(
        "Unable to share tracking",
        error instanceof Error
          ? error.message
          : "Please try again later.",
      );
    } finally {
      setShareLoading(false);
    }
  }, [id, shareLoading]);

  const bookingQuery = useQuery({
    queryKey: ["booking", id],
    queryFn: () => getBooking(id),
    enabled: Boolean(id),
  });

  const paymentsQuery = useQuery({
    queryKey: ["booking-payments", id],
    queryFn: () => getBookingPayments(id),
    enabled: Boolean(id),
  });

  const messagesQuery = useQuery({
    queryKey: ["booking-messages", id],
    queryFn: () => getBookingMessages(id),
    enabled: Boolean(id),
  });

  const refreshBooking = useCallback(async () => {
    await Promise.all([
      bookingQuery.refetch(),
      paymentsQuery.refetch(),
      messagesQuery.refetch(),
    ]);
  }, [
    bookingQuery.refetch,
    paymentsQuery.refetch,
    messagesQuery.refetch,
  ]);

  const refreshPaymentState = useCallback(async () => {
    await Promise.all([
      bookingQuery.refetch(),
      paymentsQuery.refetch(),
    ]);
  }, [
    bookingQuery.refetch,
    paymentsQuery.refetch,
  ]);

  useEffect(() => {
    if (!id) return;

    const handlePaymentReturn = ({ url }: { url: string }) => {
      if (!url.startsWith("transconet://payment-return")) return;

      // Deep link is only a navigation signal.
      // Payment success is determined exclusively by the backend.
      void refreshBooking();
    };

    const subscription = Linking.addEventListener("url", handlePaymentReturn);

    void Linking.getInitialURL().then((url) => {
      if (url) handlePaymentReturn({ url });
    });

    let cleanup: (() => void) | undefined;

    void joinBookingRealtime(id, {
      onBookingActivity: (event: BookingRealtimeEvent) => {
        setLiveStatus(event.eventType);
        void refreshBooking();
      },
      onVehicleLocation: (location) => {
        setVehicleLocation(location);
        setTrackingRegion((current) => ({
          ...current,
          latitude: location.latitude,
          longitude: location.longitude,
        }));
      },
      onAccessDenied: (message) => Alert.alert("Realtime access", message),
    })
      .then((unsubscribe) => {
        cleanup = unsubscribe;
      })
      .catch(() => {
        // REST booking data remains available if realtime is unavailable.
      });

    return () => cleanup?.();
  }, [id, refreshBooking]);

  const latestPayment = useMemo<Payment | null>(() => {
    const payments = paymentsQuery.data ?? [];

    return payments.length > 0 ? payments[0] : null;
  }, [paymentsQuery.data]);

  const handleSendMessage = useCallback(async () => {
    const content = messageText.trim();

    if (!id || !bookingQuery.data?.transporterId || !content || messageLoading) {
      return;
    }

    setMessageLoading(true);

    try {
      await sendBookingMessage({
        bookingId: id,
        recipientId: bookingQuery.data.transporterId,
        content,
      });
      setMessageText("");
      await messagesQuery.refetch();
    } catch (error) {
      Alert.alert(
        "Message error",
        error instanceof Error
          ? error.message
          : "Unable to send your message. Please try again.",
      );
    } finally {
      setMessageLoading(false);
    }
  }, [
    id,
    messageText,
    messageLoading,
    bookingQuery.data?.transporterId,
    messagesQuery.refetch,
  ]);

  const handlePayNow = useCallback(async () => {
    if (!id || paymentLoading) return;

    setPaymentLoading(true);

    try {
      let payment = latestPayment;

      if (
        !payment ||
        payment.status === "FAILED" ||
        payment.status === "REFUNDED"
      ) {
        payment = await initializePayment(id);
      }

      if (payment.status === "SUCCESS") {
        await refreshPaymentState();
        Alert.alert("Payment", "This shipment has already been paid.");
        return;
      }

      if (payment.status === "PROCESSING") {
        await refreshPaymentState();
        Alert.alert(
          "Payment processing",
          "Your payment is being processed. Please wait for the payment status to update.",
        );
        return;
      }

      if (!payment.checkoutUrl) {
        throw new Error("Flutterwave checkout link is unavailable");
      }

      const supported = await Linking.canOpenURL(payment.checkoutUrl);

      if (!supported) {
        throw new Error("Unable to open the Flutterwave checkout page");
      }

      await Linking.openURL(payment.checkoutUrl);

      await refreshBooking();
    } catch (error) {
      Alert.alert(
        "Payment error",
        error instanceof Error
          ? error.message
          : "Unable to start payment. Please try again.",
      );
    } finally {
      setPaymentLoading(false);
    }
  }, [id, latestPayment, paymentLoading, refreshPaymentState]);

  if (bookingQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!bookingQuery.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Shipment not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.button}>
          <Text style={styles.buttonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const booking = bookingQuery.data;
  const paymentStatus = booking.paymentStatus;
  const isNegotiatedBooking = booking.paymentMethod === "NEGOTIATE";
  const canPay =
    !isNegotiatedBooking &&
    paymentStatus !== "SUCCESS" &&
    paymentStatus !== "PROCESSING" &&
    paymentStatus !== "REFUNDED" &&
    Boolean(booking.fare);

  const trackingCoordinate: MapCoordinate | null = vehicleLocation
    ? {
        latitude: vehicleLocation.latitude,
        longitude: vehicleLocation.longitude,
      }
    : null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>

      <Text style={styles.title}>Shipment Details</Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>CURRENT STATUS</Text>
        <Text style={styles.status}>{booking.status}</Text>
        {liveStatus && (
          <Text style={styles.live}>Live update: {liveStatus}</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>PICKUP</Text>
        <Text style={styles.value}>{booking.pickupLocation}</Text>

        <Text style={styles.arrow}>↓</Text>

        <Text style={styles.label}>DESTINATION</Text>
        <Text style={styles.value}>{booking.destination}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>SHIPMENT</Text>
        <Text style={styles.detail}>
          Truck: {booking.truckCategory}
        </Text>
        <Text style={styles.detail}>
          Weight: {booking.cargoWeight ?? "—"}
        </Text>
        <Text style={styles.detail}>
          Fare: {booking.fare ?? booking.estimatedFare ?? "Pending"}
        </Text>
        <Text style={styles.detail}>
          Payment: {isNegotiatedBooking ? "NEGOTIATED" : paymentStatus}
        </Text>

        {isNegotiatedBooking && (
          <View style={styles.negotiatedBox}>
            <Text style={styles.negotiatedLabel}>NEGOTIATED FARE</Text>
            <Text style={styles.negotiatedTitle}>
              Fare arranged directly with the transporter
            </Text>
            <Text style={styles.negotiatedText}>
              You and the transporter agree the transport fare directly.
              The agreed fare is paid directly to the transporter. No
              TransConet customer payment is required for this negotiated
              fare.
            </Text>

            {booking.marketplaceRequestId &&
              !booking.transporterId && (
                <Pressable
                  onPress={() =>
                    router.push(
                      `/(customer)/marketplace/${booking.marketplaceRequestId}`,
                    )
                  }
                  style={styles.negotiatedButton}
                >
                  <Text style={styles.negotiatedButtonText}>
                    Review Transporter Bids
                  </Text>
                </Pressable>
              )}
          </View>
        )}

        {latestPayment?.transactionReference && (
          <Text style={styles.reference}>
            Payment reference: {latestPayment.transactionReference}
          </Text>
        )}

        {canPay && (
          <Pressable
            onPress={() => void handlePayNow()}
            disabled={paymentLoading}
            style={[
              styles.payButton,
              paymentLoading && styles.disabledButton,
            ]}
          >
            {paymentLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.payButtonText}>
                {latestPayment?.checkoutUrl
                  ? "CONTINUE PAYMENT"
                  : "PAY NOW"}
              </Text>
            )}
          </Pressable>
        )}

        {paymentStatus === "PROCESSING" && (
          <View style={styles.processingBox}>
            <Text style={styles.processingText}>
              Payment is being processed. Your shipment will update
              automatically when payment confirmation is received.
            </Text>
          </View>
        )}

        {paymentStatus === "SUCCESS" && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>Payment confirmed</Text>
          </View>
        )}
      </View>

      {booking.transporterId && (
        <View style={styles.card}>
          <Text style={styles.label}>MESSAGES</Text>

          <View style={styles.messagesBox}>
            {messagesQuery.isLoading ? (
              <ActivityIndicator />
            ) : messagesQuery.data && messagesQuery.data.length > 0 ? (
              messagesQuery.data.map((message: Message) => {
                const isCustomerMessage = message.senderId === booking.customerId;

                return (
                  <View
                    key={message.id}
                    style={[
                      styles.messageBubble,
                      isCustomerMessage
                        ? styles.customerMessage
                        : styles.transporterMessage,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        isCustomerMessage && styles.customerMessageText,
                      ]}
                    >
                      {message.content}
                    </Text>
                    <Text
                      style={[
                        styles.messageTime,
                        isCustomerMessage && styles.customerMessageTime,
                      ]}
                    >
                      {new Date(message.createdAt).toLocaleString()}
                    </Text>
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyMessages}>
                No messages yet. You can contact the transporter about this shipment.
              </Text>
            )}
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={styles.messageComposer}>
              <TextInput
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Type a message..."
                placeholderTextColor="#98A2B3"
                multiline
                editable={!messageLoading}
                style={styles.messageInput}
              />
              <Pressable
                onPress={() => void handleSendMessage()}
                disabled={messageLoading || !messageText.trim()}
                style={[
                  styles.sendMessageButton,
                  (messageLoading || !messageText.trim()) &&
                    styles.disabledButton,
                ]}
              >
                {messageLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.sendMessageText}>Send</Text>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {booking.status === "COMPLETED" && (
        <BookingReviewForm
          bookingId={booking.id}
          title="RATE TRANSPORTER"
          revieweeLabel="transporter"
        />
      )}

      {(booking.status === "ACCEPTED" ||
        booking.status === "DRIVER_ARRIVING" ||
        booking.status === "ARRIVED" ||
        booking.status === "IN_TRANSIT") && (
        <Pressable
          style={styles.shareTrackingButton}
          onPress={() => void handleShareTracking()}
          disabled={shareLoading}
        >
          {shareLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.shareTrackingText}>
              SHARE LIVE TRACKING
            </Text>
          )}
        </Pressable>
      )}

      {trackingCoordinate && (
        <View style={styles.liveMapCard}>
          <Text style={styles.label}>LIVE TRANSPORTER LOCATION</Text>
          <View style={styles.liveMap}>
            <TransConetMap
              region={trackingRegion}
              markers={[
                {
                  id: "transporter",
                  coordinate: trackingCoordinate,
                  title: "Transporter",
                  description: "Live transporter location",
                },
              ]}
          animatedMarkerId="transporter"
              interactive={false}
            />
          </View>
          <Text style={styles.trackingHint}>
            The map updates automatically while the transporter is in transit.
          </Text>
        </View>
      )}

      {vehicleLocation && (
        <View style={styles.liveCard}>
          <Text style={styles.label}>LIVE VEHICLE LOCATION</Text>
          <Text style={styles.detail}>
            Latitude: {vehicleLocation.latitude.toFixed(6)}
          </Text>
          <Text style={styles.detail}>
            Longitude: {vehicleLocation.longitude.toFixed(6)}
          </Text>
          {vehicleLocation.speed != null && (
            <Text style={styles.detail}>
              Speed: {vehicleLocation.speed}
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: "#F7F9FC",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  back: {
    color: "#175CD3",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#111827",
    marginVertical: 22,
  },
  statusCard: {
    backgroundColor: "#111827",
    borderRadius: 20,
    padding: 22,
    marginBottom: 16,
  },
  statusLabel: {
    color: "#98A2B3",
    fontSize: 11,
    fontWeight: "800",
  },
  status: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 7,
  },
  live: {
    color: "#A4F4C5",
    marginTop: 10,
    fontSize: 13,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#EAECF0",
  },
  liveMapCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#EAECF0",
  },
  liveMap: {
    height: 260,
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 8,
  },
  shareTrackingButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
  },
  shareTrackingText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  trackingHint: {
    color: "#667085",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  liveCard: {
    backgroundColor: "#EEF6FF",
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
  },
  label: {
    color: "#667085",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 7,
  },
  value: {
    color: "#1D2939",
    fontSize: 17,
    fontWeight: "700",
  },
  arrow: {
    color: "#98A2B3",
    fontSize: 20,
    marginVertical: 8,
  },
  detail: {
    color: "#475467",
    fontSize: 15,
    marginTop: 8,
  },
  reference: {
    color: "#667085",
    fontSize: 12,
    marginTop: 10,
  },
  payButton: {
    backgroundColor: "#175CD3",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  disabledButton: {
    opacity: 0.65,
  },
  payButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  processingBox: {
    backgroundColor: "#FFFAEB",
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  processingText: {
    color: "#92400E",
    fontSize: 13,
    lineHeight: 19,
  },
  negotiatedBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#D0D5DD",
  },
  negotiatedLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#667085",
  },
  negotiatedButton: {
    marginTop: 14,
    backgroundColor: "#111827",
    borderRadius: 12,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  negotiatedButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  negotiatedTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#101828",
    marginTop: 5,
  },
  negotiatedText: {
    fontSize: 12,
    lineHeight: 19,
    color: "#475467",
    marginTop: 6,
  },
  successBox: {
    backgroundColor: "#ECFDF3",
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  successText: {
    color: "#067647",
    fontSize: 14,
    fontWeight: "800",
  },
  messagesBox: {
    gap: 10,
    marginTop: 6,
  },
  messageBubble: {
    maxWidth: "86%",
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  customerMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#175CD3",
  },
  transporterMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#F2F4F7",
  },
  messageText: {
    color: "#1D2939",
    fontSize: 14,
    lineHeight: 20,
  },
  customerMessageText: {
    color: "#FFFFFF",
  },
  messageTime: {
    color: "#667085",
    fontSize: 10,
    marginTop: 5,
  },
  customerMessageTime: {
    color: "#D1E0FF",
  },
  emptyMessages: {
    color: "#667085",
    fontSize: 13,
    lineHeight: 19,
  },
  messageComposer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 14,
  },
  messageInput: {
    flex: 1,
    minHeight: 46,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#101828",
    backgroundColor: "#FFFFFF",
  },
  sendMessageButton: {
    minHeight: 46,
    minWidth: 72,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#175CD3",
    paddingHorizontal: 14,
  },
  sendMessageText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  error: {
    color: "#B42318",
    fontSize: 16,
  },
  button: {
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
    marginTop: 14,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
