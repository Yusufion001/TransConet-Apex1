import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  acceptExpressBooking,
  getExpressOffer,
  verifyExpressPickup,
} from "../../../src/api/express";

function money(value: string, currency: string) {
  const amount = Number(value);
  if (currency === "NGN" && Number.isFinite(amount)) {
    return `₦${amount.toLocaleString()}`;
  }
  return `${currency} ${value}`;
}

export default function ExpressOfferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const expressBookingId = Array.isArray(id) ? id[0] : id;

  const [accepted, setAccepted] = useState(false);
  const [acceptLoading, setAcceptLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const offerQuery = useQuery({
    queryKey: ["express-offer", expressBookingId],
    queryFn: () => getExpressOffer(expressBookingId!),
    enabled: Boolean(expressBookingId) && !accepted,
  });

  if (offerQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading Express offer...</Text>
      </View>
    );
  }

  if (offerQuery.isError || !offerQuery.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Express offer unavailable</Text>
        <Text style={styles.errorText}>
          This Express load is no longer available for you.
        </Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const offer = offerQuery.data;

  const handleAccept = async () => {
    if (acceptLoading || accepted) return;

    setAcceptLoading(true);
    setActionError(null);

    try {
      await acceptExpressBooking(offer.expressBookingId, offer.vehicleId);
      setAccepted(true);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to accept this Express load.",
      );
    } finally {
      setAcceptLoading(false);
    }
  };

  const handleVerifyPickup = async () => {
    const normalizedOtp = otp.trim();

    if (verifyLoading || normalizedOtp.length !== 6) {
      setActionError("Enter the 6-digit pickup OTP provided by the customer.");
      return;
    }

    setVerifyLoading(true);
    setActionError(null);

    try {
      await verifyExpressPickup(offer.expressBookingId, normalizedOtp);
      setVerified(true);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to verify the pickup OTP.",
      );
    } finally {
      setVerifyLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Express Load</Text>
      <Text style={styles.status}>NEARBY DISPATCH</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Route</Text>

        <Text style={styles.label}>Pickup</Text>
        <Text style={styles.value}>{offer.pickupLocation}</Text>
        {offer.pickupLandmark ? (
          <Text style={styles.detail}>{offer.pickupLandmark}</Text>
        ) : null}

        <Text style={styles.label}>Destination</Text>
        <Text style={styles.value}>{offer.destination}</Text>
        {offer.destinationLandmark ? (
          <Text style={styles.detail}>{offer.destinationLandmark}</Text>
        ) : null}

        <Text style={styles.distance}>
          {offer.distanceKm.toFixed(1)} km from your current location
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Cargo</Text>
        <Text style={styles.value}>
          {offer.cargoWeight.toLocaleString()} kg
        </Text>
        <Text style={styles.detail}>
          {offer.packageCount} package{offer.packageCount === 1 ? "" : "s"} ·{" "}
          {offer.packagingType}
        </Text>
        {offer.cargoDescription ? (
          <Text style={styles.detail}>{offer.cargoDescription}</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Trip Details</Text>
        <Text style={styles.label}>Scheduled</Text>
        <Text style={styles.value}>
          {offer.scheduledDate
            ? new Date(offer.scheduledDate).toLocaleString()
            : "As soon as possible"}
        </Text>

        <Text style={styles.label}>Fare</Text>
        <Text style={styles.fare}>{money(offer.fare, offer.currency)}</Text>
      </View>

      {actionError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorBoxText}>{actionError}</Text>
        </View>
      ) : null}

      {!accepted && !verified ? (
        <Pressable
          style={[
            styles.acceptButton,
            acceptLoading && styles.disabledButton,
          ]}
          disabled={acceptLoading}
          onPress={() => void handleAccept()}
        >
          {acceptLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.acceptText}>Accept Express Load</Text>
          )}
        </Pressable>
      ) : verified ? (
        <View style={styles.verifiedBox}>
          <Text style={styles.verifiedTitle}>PICKUP VERIFIED</Text>
          <Text style={styles.verifiedText}>
            The Express shipment is now in transit.
          </Text>
          <Pressable
            style={styles.continueButton}
            onPress={() => router.replace("/(transporter)/bookings")}
          >
            <Text style={styles.acceptText}>VIEW ASSIGNMENT</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.pickupCard}>
          <Text style={styles.sectionTitle}>PICKUP VERIFICATION</Text>

          <Text style={styles.pickupInstruction}>
            The load has been assigned to you. At pickup, ask the customer for
            the 6-digit Express pickup OTP.
          </Text>

          <Text style={styles.otpLabel}>CUSTOMER OTP</Text>

          <TextInput
            value={otp}
            onChangeText={(value) =>
              setOtp(value.replace(/\D/g, "").slice(0, 6))
            }
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000000"
            placeholderTextColor="#98A2B3"
            style={styles.otpInput}
          />

          <Pressable
            style={[
              styles.acceptButton,
              verifyLoading && styles.disabledButton,
            ]}
            disabled={verifyLoading}
            onPress={() => void handleVerifyPickup()}
          >
            {verifyLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.acceptText}>VERIFY PICKUP OTP</Text>
            )}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: "#FFFFFF",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#FFFFFF",
  },
  loadingText: {
    marginTop: 10,
    color: "#667085",
  },
  title: {
    fontSize: 25,
    fontWeight: "800",
    color: "#101828",
  },
  status: {
    marginTop: 6,
    marginBottom: 18,
    fontSize: 12,
    fontWeight: "800",
    color: "#0B63CE",
  },
  card: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EAECF0",
    backgroundColor: "#FFFFFF",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#101828",
    marginBottom: 14,
  },
  label: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "700",
    color: "#667085",
  },
  value: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "700",
    color: "#101828",
  },
  detail: {
    marginTop: 4,
    fontSize: 14,
    color: "#667085",
  },
  distance: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: "700",
    color: "#0B63CE",
  },
  fare: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: "900",
    color: "#101828",
  },
  button: {
    marginTop: 20,
    minWidth: 140,
    minHeight: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B63CE",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  acceptButton: {
    marginTop: 8,
    minHeight: 54,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B63CE",
  },
  acceptText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.65,
  },
  pickupCard: {
    marginTop: 8,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#B2DDFF",
    backgroundColor: "#EFF8FF",
  },
  pickupInstruction: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 20,
    color: "#344054",
  },
  otpLabel: {
    marginTop: 18,
    fontSize: 12,
    fontWeight: "800",
    color: "#667085",
  },
  otpInput: {
    marginTop: 8,
    minHeight: 58,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 8,
    textAlign: "center",
    color: "#101828",
  },
  errorBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FEF3F2",
  },
  errorBoxText: {
    color: "#B42318",
    fontSize: 13,
    lineHeight: 19,
  },
  verifiedBox: {
    marginTop: 8,
    padding: 18,
    borderRadius: 14,
    backgroundColor: "#ECFDF3",
  },
  verifiedTitle: {
    color: "#067647",
    fontSize: 14,
    fontWeight: "900",
  },
  verifiedText: {
    marginTop: 7,
    color: "#344054",
    fontSize: 14,
    lineHeight: 20,
  },
  continueButton: {
    marginTop: 16,
    minHeight: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#067647",
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#101828",
  },
  errorText: {
    marginTop: 8,
    textAlign: "center",
    color: "#667085",
  },
});
