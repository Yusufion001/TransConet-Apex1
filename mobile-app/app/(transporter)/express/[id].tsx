import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  verifyExpressDelivery,
  verifyExpressPickup,
} from "../../../src/api/express";
import type { ExpressAssignment } from "../../../src/api/express";
import { getTransporterExpressAssignments } from "../../../src/api/transporter";
import { useAuthStore } from "../../../src/auth/auth.store";
import {
  startTransporterLocationTracking,
  stopTransporterLocationTracking,
} from "../../../src/realtime/location-publisher";

function money(value: string, currency: string) {
  const amount = Number(value);
  if (currency === "NGN" && Number.isFinite(amount)) {
    return `₦${amount.toLocaleString()}`;
  }
  return `${currency} ${value}`;
}

export default function ExpressAssignmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const expressBookingId = Array.isArray(id) ? id[0] : id;
  const user = useAuthStore((state) => state.user);

  const [otp, setOtp] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deliveryOtp, setDeliveryOtp] = useState("");
const [deliveryVerifyLoading, setDeliveryVerifyLoading] = useState(false);
const [deliveryCompleted, setDeliveryCompleted] = useState(false);
const [deliverySettlement, setDeliverySettlement] = useState<{
  grossAmount: string;
  commissionAmount: string;
  netAmount: string;
  currency: string;
} | null>(null);

  const assignmentsQuery = useQuery({
    queryKey: ["transporter-express-assignments", user?.id],
    queryFn: () => getTransporterExpressAssignments(user!.id),
    enabled: Boolean(user?.id && expressBookingId),
  });

  if (assignmentsQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading Express assignment...</Text>
      </View>
    );
  }

  if (assignmentsQuery.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Unable to load assignment</Text>
        <Text style={styles.errorText}>
          The Express assignment could not be loaded.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => void assignmentsQuery.refetch()}
        >
          <Text style={styles.buttonText}>Try Again</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const assignment = (assignmentsQuery.data ?? []).find(
    (item) => item.expressBookingId === expressBookingId,
  ) as ExpressAssignment | undefined;

  if (!assignment) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Assignment unavailable</Text>
        <Text style={styles.errorText}>
          This Express booking is not currently assigned to you.
        </Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

const displayStatus = deliveryCompleted
  ? "COMPLETED"
  : verified
    ? "IN_TRANSIT"
    : assignment.status;

  const
handleVerifyPickup = async () => {
    const normalizedOtp = otp.trim();

    if (verifyLoading || normalizedOtp.length !== 6) {
      setActionError("Enter the 6-digit pickup OTP provided by the customer.");
      return;
    }

    setVerifyLoading(true);
    setActionError(null);

    try {
      await verifyExpressPickup(assignment.expressBookingId, normalizedOtp);
      await startTransporterLocationTracking(assignment.bookingId);
      await assignmentsQuery.refetch();
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

  const handleVerifyDelivery = async () => {
    const normalizedOtp = deliveryOtp.trim();

    if (deliveryVerifyLoading || normalizedOtp.length !== 6) {
      setActionError(
        "Enter the 6-digit delivery OTP provided by the customer.",
      );
      return;
    }

    setDeliveryVerifyLoading(true);
    setActionError(null);

    try {
      const result = await verifyExpressDelivery(
        assignment.expressBookingId,
        normalizedOtp,
      );

      await stopTransporterLocationTracking();

      setDeliveryCompleted(true);
      setDeliveryOtp("");
      setDeliverySettlement({
        grossAmount: result.settlement.grossAmount,
        commissionAmount: result.settlement.commissionAmount,
        netAmount: result.settlement.netAmount,
        currency: result.settlement.currency,
      });
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to verify the Express delivery OTP.",
      );
    } finally {
      setDeliveryVerifyLoading(false);
    }
  };

  const showPickupVerification =
    !verified &&
    (assignment.status === "ASSIGNED" ||
      assignment.status === "PICKUP_VERIFICATION");

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Express Assignment</Text>
      <Text style={styles.status}>
        {displayStatus.replace(/_/g, " ")}
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Route</Text>

        <Text style={styles.label}>Pickup</Text>
        <Text style={styles.value}>{assignment.pickupLocation}</Text>
        {assignment.pickupLandmark ? (
          <Text style={styles.detail}>{assignment.pickupLandmark}</Text>
        ) : null}

        <Text style={styles.label}>Destination</Text>
        <Text style={styles.value}>{assignment.destination}</Text>
        {assignment.destinationLandmark ? (
          <Text style={styles.detail}>{assignment.destinationLandmark}</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Cargo</Text>
        <Text style={styles.value}>
          {Number(assignment.cargoWeight).toLocaleString()} kg
        </Text>
        <Text style={styles.detail}>
          {assignment.packageCount} package
          {assignment.packageCount === 1 ? "" : "s"} ·{" "}
          {assignment.packagingType.replace(/_/g, " ")}
        </Text>
        {assignment.cargoDescription ? (
          <Text style={styles.detail}>{assignment.cargoDescription}</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Trip Details</Text>

        <Text style={styles.label}>Scheduled</Text>
        <Text style={styles.value}>
          {assignment.scheduledDate
            ? new Date(assignment.scheduledDate).toLocaleString()
            : "As soon as possible"}
        </Text>

        <Text style={styles.label}>Fare</Text>
        <Text style={styles.fare}>
          {money(assignment.fare, assignment.currency)}
        </Text>

        <Text style={styles.label}>Payment</Text>
        <Text style={styles.detail}>
          {assignment.paymentStatus.replace(/_/g, " ")}
        </Text>
      </View>

      {actionError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorBoxText}>{actionError}</Text>
        </View>
      ) : null}

      {showPickupVerification ? (
        <View style={styles.pickupCard}>
          <Text style={styles.sectionTitle}>PICKUP VERIFICATION</Text>

          <Text style={styles.pickupInstruction}>
            This Express shipment is assigned to you. At pickup, ask the
            customer for the 6-digit Express pickup OTP.
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
      ) : displayStatus === "ACTIVE" && !deliveryCompleted ? (
        <View style={styles.pickupCard}>
          <Text style={styles.sectionTitle}>DELIVERY VERIFICATION</Text>

          <Text style={styles.pickupInstruction}>
            You have reached the destination. Ask the customer for the
            6-digit Express delivery verification OTP before completing
            the shipment.
          </Text>

          <Text style={styles.otpLabel}>CUSTOMER DELIVERY OTP</Text>

          <TextInput
            value={deliveryOtp}
            onChangeText={(value) =>
              setDeliveryOtp(value.replace(/\D/g, "").slice(0, 6))
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
              deliveryVerifyLoading && styles.disabledButton,
            ]}
            disabled={deliveryVerifyLoading}
            onPress={() => void handleVerifyDelivery()}
          >
            {deliveryVerifyLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.acceptText}>VERIFY DELIVERY OTP</Text>
            )}
          </Pressable>
        </View>
      ) : deliveryCompleted ? (
        <View style={styles.verifiedBox}>
          <Text style={styles.verifiedTitle}>DELIVERY COMPLETED</Text>

          <Text style={styles.verifiedText}>
            The customer delivery OTP was verified successfully. The
            Express shipment is now completed and settlement has been
            released.
          </Text>

          {deliverySettlement ? (
            <>
              <Text style={styles.label}>GROSS FARE</Text>
              <Text style={styles.value}>
                {money(
                  deliverySettlement.grossAmount,
                  deliverySettlement.currency,
                )}
              </Text>

              <Text style={styles.label}>COMMISSION</Text>
              <Text style={styles.detail}>
                {money(
                  deliverySettlement.commissionAmount,
                  deliverySettlement.currency,
                )}
              </Text>

              <Text style={styles.label}>NET SETTLEMENT</Text>
              <Text style={styles.fare}>
                {money(
                  deliverySettlement.netAmount,
                  deliverySettlement.currency,
                )}
              </Text>
            </>
          ) : null}
        </View>
      ) : verified ? (
        <View style={styles.verifiedBox}>
          <Text style={styles.verifiedTitle}>PICKUP VERIFIED</Text>
          <Text style={styles.verifiedText}>
            The Express shipment is now in transit.
          </Text>
        </View>
      ) : (
        <View style={styles.verifiedBox}>
          <Text style={styles.verifiedTitle}>
            {displayStatus === "COMPLETED"
              ? "DELIVERY COMPLETED"
              : displayStatus === "CANCELLED"
                ? "ASSIGNMENT CANCELLED"
                : "ASSIGNMENT CONFIRMED"}
          </Text>
          <Text style={styles.verifiedText}>
            {displayStatus === "ACTIVE" || displayStatus === "IN_TRANSIT"
              ? "This Express shipment is currently in transit."
              : displayStatus === "COMPLETED"
                ? "This Express shipment has been completed."
                : displayStatus === "CANCELLED"
                  ? "This Express assignment is no longer active."
                  : "This Express shipment is assigned to you."}
          </Text>
        </View>
      )}
    </ScrollView>
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
  title: {
    fontSize: 29,
    lineHeight: 35,
    fontWeight: "900",
    color: "#101B3A",
  },
  status: {
    alignSelf: "flex-start",
    marginTop: 8,
    marginBottom: 18,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#E9EEFF",
    color: "#4169E1",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  card: {
    marginBottom: 14,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E1E7F5",
    backgroundColor: "#FFFFFF",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#101B3A",
    marginBottom: 14,
  },
  label: {
    marginTop: 12,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#98A2B3",
  },
  value: {
    marginTop: 5,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    color: "#101B3A",
  },
  detail: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 20,
    color: "#667085",
  },
  distance: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: "800",
    color: "#4169E1",
  },
  fare: {
    marginTop: 5,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "900",
    color: "#101B3A",
  },
  button: {
    marginTop: 18,
    minWidth: 145,
    minHeight: 48,
    paddingHorizontal: 22,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4169E1",
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  acceptButton: {
    marginTop: 12,
    minHeight: 54,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4169E1",
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  acceptText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  disabledButton: {
    opacity: 0.58,
  },
  pickupCard: {
    marginTop: 8,
    marginBottom: 14,
    padding: 19,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#C9D5FF",
    backgroundColor: "#EEF3FF",
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  pickupInstruction: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 21,
    color: "#344054",
  },
  otpLabel: {
    marginTop: 18,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#667085",
  },
  otpInput: {
    marginTop: 8,
    minHeight: 60,
    borderWidth: 1,
    borderColor: "#D5DCF0",
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: 8,
    textAlign: "center",
    color: "#101B3A",
  },
  errorBox: {
    marginTop: 2,
    marginBottom: 12,
    padding: 14,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#F5C2C0",
    backgroundColor: "#FFF5F4",
  },
  errorBoxText: {
    color: "#B42318",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  verifiedBox: {
    marginTop: 8,
    marginBottom: 14,
    padding: 19,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#B7E5CA",
    backgroundColor: "#F0FDF6",
    shadowColor: "#067647",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  verifiedTitle: {
    color: "#067647",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  verifiedText: {
    marginTop: 8,
    color: "#344054",
    fontSize: 14,
    lineHeight: 21,
  },
  continueButton: {
    marginTop: 16,
    minHeight: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#067647",
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#101B3A",
    textAlign: "center",
  },
  errorText: {
    marginTop: 8,
    textAlign: "center",
    color: "#667085",
    fontSize: 14,
    lineHeight: 21,
  },
});
