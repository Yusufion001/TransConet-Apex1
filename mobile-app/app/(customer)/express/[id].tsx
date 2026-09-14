import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  getExpressBookingDetails,
  startExpressPickup,
} from "../../../src/api/express";

function money(value: string | number | null | undefined) {
  if (value == null) return "Pending";

  const amount = Number(value);

  if (!Number.isFinite(amount)) return String(value);

  return `₦${amount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function paymentLabel(status: string | undefined) {
  switch (status) {
    case "SUCCESS":
      return "PAYMENT CONFIRMED";
    case "PROCESSING":
      return "PAYMENT PROCESSING";
    case "FAILED":
      return "PAYMENT FAILED";
    case "REFUNDED":
      return "PAYMENT REFUNDED";
    default:
      return "PAYMENT PENDING";
  }
}

function shipmentLabel(status: string | undefined, transporterId?: string | null) {
  if (transporterId) {
    if (status === "ASSIGNED") return "TRANSPORTER ASSIGNED";
    if (status === "DRIVER_ARRIVING") return "DRIVER ARRIVING";
    if (status === "ARRIVED") return "DRIVER ARRIVED";
    if (status === "IN_TRANSIT") return "IN TRANSIT";
    if (status === "COMPLETED") return "COMPLETED";
  }

  if (status === "COMPLETED") return "COMPLETED";
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "DISPUTED") return "DISPUTED";

  return "SEARCHING FOR TRANSPORTER";
}

export default function ExpressBookingDetails() {
  const params = useLocalSearchParams<{
    id: string;
    bookingId?: string;
    paymentStatus?: string;
    checkoutUrl?: string;
  }>();

  const expressBookingId = String(params.id ?? "");
  const initialPaymentStatus = String(params.paymentStatus ?? "PENDING");
  const checkoutUrl = params.checkoutUrl
    ? String(params.checkoutUrl)
    : null;

  const [paymentLoading, setPaymentLoading] = useState(false);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [pickupOtp, setPickupOtp] = useState<string | null>(null);
  const [pickupOtpExpiresAt, setPickupOtpExpiresAt] = useState<string | null>(null);

  const bookingQuery = useQuery({
    queryKey: ["express-booking", expressBookingId],
    queryFn: () => getExpressBookingDetails(expressBookingId),
    enabled: Boolean(expressBookingId),
    refetchInterval: 5000,
  });

  const expressDetails = bookingQuery.data;
  const booking = expressDetails?.booking;

  const currentPaymentStatus =
    booking?.paymentStatus ?? initialPaymentStatus;

  const shipmentStatus = booking?.status;
  const transporterAssigned = Boolean(booking?.transporterId);

  const statusTitle = useMemo(
    () => shipmentLabel(shipmentStatus, booking?.transporterId),
    [shipmentStatus, booking?.transporterId],
  );

  const refresh = useCallback(async () => {
    await bookingQuery.refetch();
  }, [bookingQuery.refetch]);

  const handleStartPickup = useCallback(async () => {
    if (
      pickupLoading ||
      pickupOtp ||
      shipmentStatus !== "ASSIGNED" ||
      !transporterAssigned
    ) {
      return;
    }

    setPickupLoading(true);

    try {
      const result = await startExpressPickup(expressBookingId);

      setPickupOtp(result.otp);
      setPickupOtpExpiresAt(result.expiresAt);

      await refresh();
    } catch (error) {
      Alert.alert(
        "Pickup verification",
        error instanceof Error
          ? error.message
          : "Unable to start Express pickup verification. Please try again.",
      );
    } finally {
      setPickupLoading(false);
    }
  }, [
    expressBookingId,
    pickupLoading,
    pickupOtp,
    refresh,
    shipmentStatus,
    transporterAssigned,
  ]);

  const handlePayNow = useCallback(async () => {
    if (!checkoutUrl || paymentLoading) return;

    setPaymentLoading(true);

    try {
      if (currentPaymentStatus === "SUCCESS") {
        await refresh();
        Alert.alert(
          "Payment confirmed",
          "Your Express payment has already been confirmed.",
        );
        return;
      }

      const supported = await Linking.canOpenURL(checkoutUrl);

      if (!supported) {
        throw new Error("Unable to open the Paystack checkout page.");
      }

      await Linking.openURL(checkoutUrl);
      await refresh();
    } catch (error) {
      Alert.alert(
        "Payment error",
        error instanceof Error
          ? error.message
          : "Unable to open Paystack checkout. Please try again.",
      );
    } finally {
      setPaymentLoading(false);
    }
  }, [checkoutUrl, currentPaymentStatus, paymentLoading, refresh]);

  if (!expressBookingId) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>
          Express booking information is unavailable.
        </Text>
        <Pressable onPress={() => router.back()} style={styles.button}>
          <Text style={styles.buttonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (bookingQuery.isLoading && !booking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading Express booking...</Text>
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Express shipment not found.</Text>
        <Pressable onPress={() => void refresh()} style={styles.button}>
          <Text style={styles.buttonText}>Try Again</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const paymentComplete = currentPaymentStatus === "SUCCESS";
  const canPay =
    !paymentComplete &&
    currentPaymentStatus !== "PROCESSING" &&
    currentPaymentStatus !== "REFUNDED" &&
    Boolean(checkoutUrl);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>

      <Text style={styles.title}>Express Booking</Text>

      <View style={styles.expressBadge}>
        <Text style={styles.expressBadgeText}>
          EXPRESS · SEPARATE FROM MARKETPLACE
        </Text>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>CURRENT STATUS</Text>
        <Text style={styles.status}>{statusTitle}</Text>

        {bookingQuery.isFetching && (
          <Text style={styles.live}>Updating shipment status...</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>PAYMENT</Text>
        <Text
          style={[
            styles.paymentStatus,
            paymentComplete && styles.paymentSuccess,
          ]}
        >
          {paymentLabel(currentPaymentStatus)}
        </Text>

        <Text style={styles.amount}>
          {money(booking.fare ?? booking.estimatedFare)}
        </Text>

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
              <Text style={styles.payButtonText}>PAY WITH PAYSTACK</Text>
            )}
          </Pressable>
        )}

        {currentPaymentStatus === "PROCESSING" && (
          <View style={styles.processingBox}>
            <Text style={styles.processingText}>
              Your payment is being processed. TransConet will update this
              shipment automatically when Paystack confirmation is received.
            </Text>
          </View>
        )}

        {paymentComplete && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>
              Payment confirmed. TransConet is now handling Express dispatch.
            </Text>
          </View>
        )}

        {!paymentComplete && !checkoutUrl && (
          <View style={styles.processingBox}>
            <Text style={styles.processingText}>
              A Paystack checkout link is not currently available. Please
              refresh or contact support if this continues.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>EXPRESS SHIPMENT</Text>

        <Text style={styles.routeLabel}>PICKUP</Text>
        <Text style={styles.value}>{booking.pickupLocation}</Text>

        <Text style={styles.arrow}>↓</Text>

        <Text style={styles.routeLabel}>DESTINATION</Text>
        <Text style={styles.value}>{booking.destination}</Text>

        <View style={styles.detailDivider} />

        <Text style={styles.detail}>
          Weight: {booking.cargoWeight ?? "—"}
        </Text>

        <Text style={styles.detail}>
          Fare: {money(booking.fare ?? booking.estimatedFare)}
        </Text>

        <Text style={styles.detail}>
          Booking ID: {expressBookingId}
        </Text>
      </View>

      {shipmentStatus === "ASSIGNED" && transporterAssigned && (
        <View style={styles.card}>
          <Text style={styles.label}>EXPRESS PICKUP VERIFICATION</Text>

          {!pickupOtp ? (
            <>
              <Text style={styles.dispatchText}>
                Your transporter has been assigned. Start pickup verification
                when the transporter is ready to collect your shipment.
              </Text>

              <Pressable
                onPress={() => void handleStartPickup()}
                disabled={pickupLoading}
                style={[
                  styles.pickupButton,
                  pickupLoading && styles.disabledButton,
                ]}
              >
                {pickupLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.pickupButtonText}>
                    START PICKUP VERIFICATION
                  </Text>
                )}
              </Pressable>
            </>
          ) : (
            <View style={styles.otpBox}>
              <Text style={styles.otpTitle}>PICKUP OTP</Text>
              <Text style={styles.otpValue}>{pickupOtp}</Text>
              {pickupOtpExpiresAt && (
                <Text style={styles.otpExpiry}>
                  Expires:{" "}
                  {new Date(pickupOtpExpiresAt).toLocaleTimeString("en-NG", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              )}
              <Text style={styles.otpInstruction}>
                Give this OTP to your assigned transporter at pickup. The
                shipment will move to IN TRANSIT after the transporter verifies
                it.
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.label}>DISPATCH</Text>

        {transporterAssigned ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>
              A transporter has been assigned to your Express shipment.
            </Text>
          </View>
        ) : paymentComplete ? (
          <View style={styles.dispatchBox}>
            <ActivityIndicator size="small" />
            <Text style={styles.dispatchTitle}>
              Searching for an available transporter
            </Text>
            <Text style={styles.dispatchText}>
              Your payment is confirmed. Express dispatch is searching for an
              approved transporter and suitable vehicle.
            </Text>
          </View>
        ) : (
          <Text style={styles.dispatchText}>
            Transporter dispatch starts after your payment is confirmed.
          </Text>
        )}
      </View>

      <Pressable
        onPress={() => void refresh()}
        disabled={bookingQuery.isFetching}
        style={[
          styles.refreshButton,
          bookingQuery.isFetching && styles.disabledButton,
        ]}
      >
        {bookingQuery.isFetching ? (
          <ActivityIndicator />
        ) : (
          <Text style={styles.refreshButtonText}>REFRESH STATUS</Text>
        )}
      </Pressable>
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
  loadingText: {
    color: "#667085",
    marginTop: 12,
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
    marginVertical: 18,
  },
  expressBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#EAF2FF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 14,
  },
  expressBadgeText: {
    color: "#175CD3",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
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
    fontSize: 22,
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
  label: {
    color: "#667085",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 10,
  },
  paymentStatus: {
    color: "#92400E",
    fontSize: 15,
    fontWeight: "800",
  },
  paymentSuccess: {
    color: "#067647",
  },
  amount: {
    color: "#111827",
    fontSize: 25,
    fontWeight: "800",
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
  payButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.65,
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
  successBox: {
    backgroundColor: "#ECFDF3",
    borderRadius: 12,
    padding: 13,
    marginTop: 14,
  },
  successText: {
    color: "#067647",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  routeLabel: {
    color: "#667085",
    fontSize: 10,
    fontWeight: "900",
    marginTop: 4,
    marginBottom: 6,
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
  detailDivider: {
    height: 1,
    backgroundColor: "#EAECF0",
    marginVertical: 14,
  },
  detail: {
    color: "#475467",
    fontSize: 14,
    marginTop: 7,
  },
  dispatchBox: {
    backgroundColor: "#EEF6FF",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  dispatchTitle: {
    color: "#175CD3",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 10,
    textAlign: "center",
  },
  dispatchText: {
    color: "#475467",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  pickupButton: {
    backgroundColor: "#175CD3",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  pickupButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  otpBox: {
    backgroundColor: "#EEF6FF",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
  },
  otpTitle: {
    color: "#175CD3",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  otpValue: {
    color: "#111827",
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: 8,
    marginTop: 8,
  },
  otpExpiry: {
    color: "#475467",
    fontSize: 12,
    marginTop: 8,
  },
  otpInstruction: {
    color: "#344054",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 14,
  },
  refreshButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  refreshButtonText: {
    color: "#344054",
    fontSize: 14,
    fontWeight: "800",
  },
  button: {
    backgroundColor: "#175CD3",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 18,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  secondaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 10,
  },
  secondaryButtonText: {
    color: "#175CD3",
    fontWeight: "800",
  },
  error: {
    color: "#B42318",
    fontSize: 15,
    textAlign: "center",
  },
});
