import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { launchCameraAsync, requestCameraPermissionsAsync } from "expo-image-picker";
import { File } from "expo-file-system";
import SignatureView, { type SignatureViewRef } from "expo-signature-canvas";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getBooking,
  getDeliveryProofUploadUrl,
  updateBookingStatus,
  uploadProofOfDelivery,
} from "../../../src/api/bookings";
import {
  getCommissionPaymentStatus,
  initializeCommissionPayment,
  type CommissionPaymentProvider,
} from "../../../src/api/commission-payments";
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

function money(
  value: string | number | null | undefined,
  currency: string | null | undefined,
) {
  if (value == null) return "—";

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return `${value} ${currency ?? ""}`.trim();
  }

  const code = currency?.toUpperCase();

  if (code === "NGN" || !code) {
    return `₦${amount.toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  return `${code} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

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
  const [cargoPhotoUri, setCargoPhotoUri] = useState<string | null>(null);
  const [receiverSignature, setReceiverSignature] = useState<string | null>(null);
  const signatureRef = useRef<SignatureViewRef | null>(null);
  const [bankTransferReference, setBankTransferReference] = useState("");

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

  const commissionQuery = useQuery({
    queryKey: [
      "transporter-commission-payment",
      query.data?.negotiationAgreementId,
    ],
    queryFn: () =>
      getCommissionPaymentStatus(
        query.data!.negotiationAgreementId!,
      ),
    enabled:
      query.data?.paymentMethod === "NEGOTIATE" &&
      Boolean(query.data?.negotiationAgreementId),
  });

  const commissionPaymentMutation = useMutation({
    mutationFn: ({
      provider,
      transactionReference,
    }: {
      provider: CommissionPaymentProvider;
      transactionReference?: string;
    }) =>
      initializeCommissionPayment(
        query.data!.negotiationAgreementId!,
        provider,
        transactionReference,
      ),
    onSuccess: async (payment) => {
      await commissionQuery.refetch();

      if (payment.provider === "FLUTTERWAVE" && payment.checkoutUrl) {
        await Linking.openURL(payment.checkoutUrl);
        return;
      }

      Alert.alert(
        "Commission payment submitted",
        "Your bank transfer reference has been submitted. The payment will remain pending until TransConet verifies it.",
      );
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to submit commission payment.";

      Alert.alert("Commission payment failed", message);
    },
  });

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

      if (status === "ACCEPTED") {
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

  const takeCargoPhoto = async () => {
    const permission = await requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Camera permission required",
        "Allow camera access to capture the cargo photo.",
      );
      return;
    }

    const result = await launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setCargoPhotoUri(result.assets[0].uri);
    }
  };

  const handleSignature = (signature: string) => {
    setReceiverSignature(signature);
  };

  const proofMutation = useMutation({
    mutationFn: async () => {
      if (!cargoPhotoUri) {
        throw new Error("Cargo photo is required.");
      }

      if (!receiverSignature) {
        throw new Error("Receiver signature is required.");
      }

      const photoFile = new File(cargoPhotoUri);

      const photoUpload = await getDeliveryProofUploadUrl(
        id!,
        "CARGO_PHOTO",
        cargoPhotoUri.split("/").pop() || "cargo-photo.jpg",
      );

      const photoBytes = await photoFile.arrayBuffer();

      const photoResponse = await fetch(photoUpload.signedUrl, {
        method: "POST",
        headers: {
          "Content-Type": photoFile.type || "image/jpeg",
        },
        body: photoBytes,
      });

      if (!photoResponse.ok) {
        throw new Error("Unable to upload cargo photo.");
      }

      const signatureBlob = await fetch(receiverSignature).then((response) =>
        response.blob(),
      );

      const signatureUpload = await getDeliveryProofUploadUrl(
        id!,
        "RECEIVER_SIGNATURE",
        "receiver-signature.png",
      );

      const signatureBytes = await signatureBlob.arrayBuffer();

      const signatureResponse = await fetch(
        signatureUpload.signedUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "image/png",
          },
          body: signatureBytes,
        },
      );

      if (!signatureResponse.ok) {
        throw new Error("Unable to upload receiver signature.");
      }

      return uploadProofOfDelivery(
        id!,
        proof.trim(),
        photoUpload.storagePath,
        signatureUpload.storagePath,
      );
    },

    onSuccess: async (updatedBooking) => {
      setProof("");
      setCargoPhotoUri(null);
      setReceiverSignature(null);
      signatureRef.current?.clearSignature();

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

  useEffect(() => {
    const handleCommissionReturn = (url: string | null) => {
      if (!url || !url.startsWith("transconet://commission-payment-return")) {
        return;
      }

      const separator = url.includes("?") ? "?" : "";
      const queryString = separator ? url.split("?")[1] ?? "" : "";
      const params = new URLSearchParams(queryString);
      const status = params.get("status");

      void commissionQuery.refetch();

      if (status === "success") {
        Alert.alert(
          "Commission payment",
          "Your commission payment was completed successfully.",
        );
      } else if (status === "failed") {
        Alert.alert(
          "Commission payment",
          "The commission payment was not completed. You can review the payment status and try again if the commission is still due.",
        );
      }
    };

    const subscription = Linking.addEventListener(
      "url",
      ({ url }) => handleCommissionReturn(url),
    );

    void Linking.getInitialURL().then(handleCommissionReturn);

    return () => subscription.remove();
  }, [commissionQuery.refetch]);

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
          value={money(booking.fare ?? booking.estimatedFare, "NGN")}
        />

        <InfoRow
          label="Payment method"
          value={
            booking.paymentMethod === "NEGOTIATE"
              ? "Negotiated"
              : booking.paymentMethod.replace(/_/g, " ")
          }
        />

        {booking.paymentMethod === "NEGOTIATE" ? (
          <View style={styles.commissionCard}>
            <Text style={styles.commissionTitle}>
              TRANSCONET COMMISSION
            </Text>

            <Text style={styles.commissionHeadline}>
              Separate from your earnings
            </Text>

            <Text style={styles.commissionText}>
              The customer pays the agreed negotiated fare directly to you.
              TransConet does not collect that fare. Your separate platform
              commission is shown below and is not part of your Wallet.
            </Text>

            {commissionQuery.isLoading ? (
              <View style={styles.commissionLoading}>
                <ActivityIndicator size="small" />
                <Text style={styles.commissionLoadingText}>
                  Loading commission obligation...
                </Text>
              </View>
            ) : commissionQuery.isError ? (
              <View style={styles.commissionNotice}>
                <Text style={styles.commissionNoticeText}>
                  Unable to load the current commission payment status.
                </Text>
                <Pressable
                  onPress={() => void commissionQuery.refetch()}
                  style={styles.commissionSecondaryButton}
                >
                  <Text style={styles.commissionSecondaryButtonText}>
                    Retry
                  </Text>
                </Pressable>
              </View>
            ) : commissionQuery.data ? (
              <>
                <View style={styles.commissionAmountBox}>
                  <Text style={styles.commissionAmountLabel}>
                    COMMISSION DUE
                  </Text>
                  <Text style={styles.commissionAmount}>
                    {money(
                      commissionQuery.data.commissionAmount,
                      commissionQuery.data.currency,
                    )}
                  </Text>
                  <Text style={styles.commissionStatus}>
                    {formatStatus(commissionQuery.data.commissionStatus)}
                  </Text>
                </View>

                {commissionQuery.data.commissionPayment?.status ===
                  "SUCCESS" ||
                commissionQuery.data.commissionStatus === "PAID" ? (
                  <View style={styles.commissionSuccess}>
                    <Text style={styles.commissionSuccessText}>
                      Commission payment verified successfully.
                    </Text>
                  </View>
                ) : commissionQuery.data.commissionPayment?.status ===
                    "PENDING" ||
                  commissionQuery.data.commissionPayment?.status ===
                    "PROCESSING" ||
                  commissionQuery.data.commissionStatus ===
                    "PAYMENT_PENDING" ? (
                  <View style={styles.commissionNotice}>
                    <Text style={styles.commissionNoticeText}>
                      Commission payment is pending verification. If you
                      submitted a bank transfer, TransConet will verify it
                      through Financial Operations.
                    </Text>
                  </View>
                ) : commissionQuery.data.commissionStatus === "DUE" ? (
                  <View style={styles.commissionActions}>
                    <Pressable
                      disabled={commissionPaymentMutation.isPending}
                      onPress={() =>
                        commissionPaymentMutation.mutate({
                          provider: "FLUTTERWAVE",
                        })
                      }
                      style={[
                        styles.commissionPrimaryButton,
                        commissionPaymentMutation.isPending &&
                          styles.commissionButtonDisabled,
                      ]}
                    >
                      {commissionPaymentMutation.isPending ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.commissionPrimaryButtonText}>
                          Pay Commission with Flutterwave
                        </Text>
                      )}
                    </Pressable>

                    <Text style={styles.commissionOrText}>
                      OR
                    </Text>

                    <TextInput
                      value={bankTransferReference}
                      onChangeText={setBankTransferReference}
                      placeholder="Bank transfer reference"
                      autoCapitalize="characters"
                      editable={!commissionPaymentMutation.isPending}
                      style={styles.commissionInput}
                    />

                    <Pressable
                      disabled={
                        commissionPaymentMutation.isPending ||
                        bankTransferReference.trim().length < 3
                      }
                      onPress={() =>
                        commissionPaymentMutation.mutate({
                          provider: "BANK_TRANSFER",
                          transactionReference:
                            bankTransferReference.trim(),
                        })
                      }
                      style={[
                        styles.commissionSecondaryButton,
                        (commissionPaymentMutation.isPending ||
                          bankTransferReference.trim().length < 3) &&
                          styles.commissionButtonDisabled,
                      ]}
                    >
                      <Text style={styles.commissionSecondaryButtonText}>
                        Submit Bank Transfer
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.commissionNotice}>
                    <Text style={styles.commissionNoticeText}>
                      Commission status:{" "}
                      {formatStatus(commissionQuery.data.commissionStatus)}.
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.commissionNotice}>
                <Text style={styles.commissionNoticeText}>
                  Commission information is not currently available.
                </Text>
              </View>
            )}
          </View>
        ) : (
          <InfoRow
            label="Payment"
            value={booking.paymentStatus}
          />
        )}

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

          <Text style={styles.formLabel}>Cargo Photo</Text>

          {cargoPhotoUri ? (
            <Image
              source={{ uri: cargoPhotoUri }}
              style={styles.proofImage}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.messageMuted}>
              Take a clear photo of the cargo at delivery.
            </Text>
          )}

          <Pressable
            disabled={proofMutation.isPending}
            onPress={takeCargoPhoto}
            style={[
              styles.smallButton,
              proofMutation.isPending && styles.disabled,
            ]}
          >
            <Text style={styles.smallButtonText}>
              {cargoPhotoUri ? "Retake Cargo Photo" : "Take Cargo Photo"}
            </Text>
          </Pressable>

          <Text style={styles.formLabel}>Receiver Signature</Text>

          <View style={styles.signatureBox}>
            <SignatureView
              ref={signatureRef}
              onOK={handleSignature}
              onEmpty={() =>
                Alert.alert(
                  "Signature required",
                  "Please ask the receiver to sign before submitting.",
                )
              }
              autoClear={false}
              imageType="image/png"
              webStyle={`
                .m-signature-pad { box-shadow: none; border: none; }
                .m-signature-pad--body { border: none; }
                .m-signature-pad--footer { display: none; margin: 0; }
                body, html { width: 100%; height: 100%; }
              `}
              style={styles.signature}
            />
          </View>

          {receiverSignature && (
            <Text style={styles.successText}>
              Receiver signature captured.
            </Text>
          )}

          <Pressable
            disabled={proofMutation.isPending}
            onPress={() => signatureRef.current?.readSignature()}
            style={[
              styles.smallButton,
              proofMutation.isPending && styles.disabled,
            ]}
          >
            <Text style={styles.smallButtonText}>Save Signature</Text>
          </Pressable>

          <Pressable
            disabled={
              proofMutation.isPending ||
              !proof.trim() ||
              !cargoPhotoUri ||
              !receiverSignature
            }
            onPress={submitProof}
            style={[
              styles.primaryButton,
              (proofMutation.isPending ||
                !proof.trim() ||
                !cargoPhotoUri ||
                !receiverSignature) &&
                styles.disabled,
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
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 48,
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
  back: {
    alignSelf: "flex-start",
    color: "#4169E1",
    backgroundColor: "#EAF0FF",
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 20,
    overflow: "hidden",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.7,
    color: "#4169E1",
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    color: "#101B3A",
    marginTop: 5,
    marginBottom: 18,
  },
  statusCard: {
    backgroundColor: "#101B3A",
    borderRadius: 23,
    padding: 22,
    marginBottom: 16,
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#34D399",
    marginRight: 8,
  },
  statusLabel: {
    color: "#AEB9D5",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  status: {
    color: "#FFFFFF",
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "900",
    marginTop: 9,
  },
  statusDescription: {
    color: "#CBD5EA",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 9,
  },
  live: {
    alignSelf: "flex-start",
    color: "#A7F3D0",
    backgroundColor: "#173B36",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 13,
    overflow: "hidden",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 19,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E1E7F5",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionLabel: {
    color: "#667085",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginBottom: 15,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  pickupDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#4169E1",
    marginTop: 4,
    marginRight: 12,
  },
  destinationDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#101B3A",
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
    letterSpacing: 1.1,
  },
  location: {
    color: "#101B3A",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    marginTop: 5,
  },
  routeConnector: {
    height: 25,
    width: 2,
    backgroundColor: "#DCE3F3",
    marginLeft: 4,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E8ECF5",
  },
  infoLabel: {
    flex: 1,
    color: "#667085",
    fontSize: 13,
    lineHeight: 19,
  },
  infoValue: {
    flex: 1.25,
    color: "#101B3A",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    textAlign: "right",
  },
  commissionCard: {
    backgroundColor: "#F4F7FF",
    borderRadius: 16,
    padding: 16,
    marginTop: 15,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#DCE4F7",
  },
  commissionTitle: {
    color: "#4169E1",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.3,
  },
  commissionHeadline: {
    color: "#101B3A",
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
    marginTop: 7,
  },
  commissionText: {
    color: "#475467",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 7,
  },
  commissionNotice: {
    backgroundColor: "#FFF7E8",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#F1D59A",
  },
  commissionNoticeText: {
    color: "#7A4E00",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  commissionLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  },
  commissionLoadingText: {
    color: "#667085",
    fontSize: 12,
    fontWeight: "600",
  },
  commissionAmountBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 15,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#E1E7F5",
  },
  commissionAmountLabel: {
    color: "#667085",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  commissionAmount: {
    color: "#101B3A",
    fontSize: 23,
    lineHeight: 29,
    fontWeight: "900",
    marginTop: 5,
  },
  commissionStatus: {
    color: "#667085",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  commissionActions: {
    marginTop: 14,
  },
  commissionPrimaryButton: {
    minHeight: 48,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "#4169E1",
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 7,
    elevation: 3,
  },
  commissionPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  commissionSecondaryButton: {
    minHeight: 46,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D5DDF0",
    marginTop: 10,
  },
  commissionSecondaryButtonText: {
    color: "#344054",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  commissionButtonDisabled: {
    opacity: 0.5,
  },
  commissionOrText: {
    color: "#98A2B3",
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
    marginVertical: 10,
  },
  commissionInput: {
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#D5DDF0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    color: "#101B3A",
    fontSize: 14,
  },
  commissionSuccess: {
    backgroundColor: "#ECFDF3",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#ABEFC6",
  },
  commissionSuccessText: {
    color: "#027A48",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  liveCard: {
    backgroundColor: "#EAF2FF",
    borderRadius: 20,
    padding: 19,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#D4E2FF",
  },
  locationValue: {
    color: "#4169E1",
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "900",
  },
  locationMeta: {
    color: "#667085",
    marginTop: 7,
    fontSize: 12,
    fontWeight: "600",
  },
  actionCard: {
    backgroundColor: "#EAF2FF",
    borderRadius: 20,
    padding: 19,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#D4E2FF",
  },
  actionTitle: {
    color: "#101B3A",
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "900",
  },
  actionText: {
    color: "#475467",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
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
    backgroundColor: "#F9FAFF",
    borderWidth: 1,
    borderColor: "#D8E0F0",
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#101B3A",
    marginBottom: 12,
  },
  multiline: {
    minHeight: 92,
    textAlignVertical: "top",
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#4169E1",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 4,
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 7,
    elevation: 3,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.55,
  },
  cancelButton: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F3B4AE",
    backgroundColor: "#FFF5F4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  cancelText: {
    color: "#B42318",
    fontSize: 14,
    fontWeight: "900",
  },
  button: {
    backgroundColor: "#4169E1",
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
    marginTop: 17,
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 7,
    elevation: 3,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  errorTitle: {
    color: "#101B3A",
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
  },
  errorText: {
    color: "#667085",
    marginTop: 7,
    textAlign: "center",
    lineHeight: 20,
  },
  footer: {
    alignItems: "center",
    marginTop: 8,
  },
  messageLoading: {
    alignItems: "center",
    paddingVertical: 14,
  },
  messageMuted: {
    marginTop: 8,
    color: "#667085",
    lineHeight: 20,
    fontSize: 13,
  },
  messageError: {
    color: "#B42318",
    fontWeight: "700",
    marginBottom: 10,
  },
  smallButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#EAF0FF",
    borderWidth: 1,
    borderColor: "#D6E1FF",
  },
  smallButtonText: {
    color: "#4169E1",
    fontWeight: "800",
    fontSize: 12,
  },
  messageList: {
    gap: 10,
    marginBottom: 14,
  },
  messageBubble: {
    padding: 13,
    borderRadius: 15,
    maxWidth: "88%",
    borderWidth: 1,
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#EAF0FF",
    borderColor: "#D5E0FF",
  },
  customerMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#F7F8FC",
    borderColor: "#E8ECF5",
  },
  messageSender: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
    color: "#667085",
    marginBottom: 4,
  },
  messageContent: {
    fontSize: 14,
    lineHeight: 20,
    color: "#101B3A",
  },
  messageDate: {
    marginTop: 5,
    fontSize: 9,
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
  proofImage: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E1E7F5",
  },
  signatureBox: {
    height: 220,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#D5DDF0",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  signature: {
    flex: 1,
    width: "100%",
  },
  successText: {
    color: "#027A48",
    backgroundColor: "#ECFDF3",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 8,
    overflow: "hidden",
  },
});
