import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMarketplaceRequest,
  selectMarketplaceBid,
} from "../../../src/api/marketplace";

function formatAmount(amount: string | number | null | undefined) {
  if (amount == null) {
    return "Pending";
  }

  const value = Number(amount);

  if (!Number.isFinite(value)) {
    return String(amount);
  }

  return `NGN ${value.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

function isExpired(expiresAt: string | null) {
  return Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
}

export default function CustomerMarketplaceRequest() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const requestId = Array.isArray(params.id) ? params.id[0] : params.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["marketplace-request", requestId],
    queryFn: () => getMarketplaceRequest(requestId!),
    enabled: Boolean(requestId),
  });

  const selectMutation = useMutation({
    mutationFn: ({
      bidId,
    }: {
      bidId: string;
    }) => selectMarketplaceBid(requestId!, bidId),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: ["customer-bookings"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["customer-booking", result.booking.id],
      });

      Alert.alert(
        "Transporter selected",
        "The negotiated fare has been agreed. You will pay the agreed transport fare directly to the transporter, not through TransConet.",
        [
          {
            text: "View Shipment",
            onPress: () =>
              router.replace(
                `/(customer)/bookings/${result.booking.id}`,
              ),
          },
        ],
      );
    },
    onError: (error: any) => {
      Alert.alert(
        "Unable to select bid",
        error?.response?.data?.error ??
          "The bid could not be selected. It may no longer be available.",
      );
    },
  });

  if (query.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading transporter bids...</Text>
      </View>
    );
  }

  if (query.isError || !query.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Bids unavailable</Text>
        <Text style={styles.errorText}>
          The transporter bids could not be loaded.
        </Text>

        <Pressable onPress={() => query.refetch()} style={styles.button}>
          <Text style={styles.buttonText}>Try Again</Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const request = query.data;
  const canSelect = request.status === "OPEN";

  const pendingBids = request.bids.filter(
    (bid) => bid.status === "PENDING" && !isExpired(bid.expiresAt),
  );

  const confirmSelection = (bidId: string, amount: string) => {
    Alert.alert(
      "Select this transporter?",
      `You are accepting the negotiated fare of ${formatAmount(
        amount,
      )}. The fare will be paid directly to the transporter, not through TransConet.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Select Transporter",
          onPress: () => selectMutation.mutate({ bidId }),
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
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>

      <Text style={styles.eyebrow}>NEGOTIATED FARE</Text>
      <Text style={styles.title}>Transporter Bids</Text>
      <Text style={styles.subtitle}>
        Review the offers from transporters and select the one you want.
      </Text>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>How negotiated fare works</Text>
        <Text style={styles.noticeText}>
          The fare shown on a selected bid is agreed directly between you
          and the transporter. TransConet does not collect this negotiated
          transport fare.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>SHIPMENT</Text>

        <Text style={styles.location}>{request.pickupLocation}</Text>
        <Text style={styles.arrow}>↓</Text>
        <Text style={styles.location}>{request.destination}</Text>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Estimated fare</Text>
          <Text style={styles.infoValue}>
            {formatAmount(request.estimatedFare)}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Request status</Text>
          <Text style={styles.infoValue}>{request.status}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Created</Text>
          <Text style={styles.infoValue}>{formatDate(request.createdAt)}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>
        {pendingBids.length} Available{" "}
        {pendingBids.length === 1 ? "Bid" : "Bids"}
      </Text>

      {pendingBids.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            No available transporter bids
          </Text>
          <Text style={styles.emptyText}>
            There are currently no pending bids available for selection.
            Pull to refresh later for new offers.
          </Text>

          <Pressable
            onPress={() => query.refetch()}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Refresh Bids</Text>
          </Pressable>
        </View>
      ) : (
        pendingBids.map((bid) => {
          const transporterName =
            `${bid.transporter.firstName} ${bid.transporter.lastName}`.trim();

          const rating = bid.transporter.profile?.rating;
          const trips = bid.transporter.profile?.totalTrips;

          return (
            <View key={bid.id} style={styles.bidCard}>
              <View style={styles.bidHeader}>
                <View style={styles.bidIdentity}>
                  <Text style={styles.bidName}>
                    {transporterName || "Transporter"}
                  </Text>
                  <Text style={styles.bidTier}>
                    {bid.transporter.transporterTier.replace(/_/g, " ")}
                  </Text>
                </View>

                <Text style={styles.bidAmount}>
                  {formatAmount(bid.amount)}
                </Text>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Rating</Text>
                  <Text style={styles.statValue}>
                    {rating == null ? "—" : String(rating)}
                  </Text>
                </View>

                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Trips</Text>
                  <Text style={styles.statValue}>
                    {trips == null ? "—" : String(trips)}
                  </Text>
                </View>

                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Vehicle</Text>
                  <Text style={styles.statValue}>
                    {bid.vehicle.vehicleType.replace(/_/g, " ")}
                  </Text>
                </View>
              </View>

              <Text style={styles.vehicleClass}>
                {bid.vehicle.vehicleClass.replace(/_/g, " ")}
              </Text>

              {bid.message && (
                <View style={styles.messageBox}>
                  <Text style={styles.messageLabel}>TRANSPORTER MESSAGE</Text>
                  <Text style={styles.message}>{bid.message}</Text>
                </View>
              )}

              {bid.expiresAt && (
                <Text style={styles.expires}>
                  Bid expires: {formatDate(bid.expiresAt)}
                </Text>
              )}

              <Pressable
                disabled={selectMutation.isPending || !canSelect}
                onPress={() => confirmSelection(bid.id, bid.amount)}
                style={[
                  styles.primaryButton,
                  (selectMutation.isPending || !canSelect) &&
                    styles.disabled,
                ]}
              >
                {selectMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    Select This Transporter
                  </Text>
                )}
              </Pressable>
            </View>
          );
        })
      )}

      {request.status !== "OPEN" && (
        <View style={styles.closedNotice}>
          <Text style={styles.closedTitle}>
            This negotiation is no longer open
          </Text>
          <Text style={styles.closedText}>
            The transporter selection period for this request has ended.
          </Text>
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
  loadingText: {
    marginTop: 12,
    color: "#667085",
  },
  back: {
    color: "#175CD3",
    fontWeight: "800",
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "#7A4E00",
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#111827",
    marginTop: 5,
  },
  subtitle: {
    fontSize: 15,
    color: "#667085",
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 20,
  },
  notice: {
    backgroundColor: "#FFF7E8",
    borderWidth: 1,
    borderColor: "#F2C94C",
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#7A4E00",
  },
  noticeText: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 20,
    color: "#694F1D",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EAECF0",
    marginBottom: 22,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#667085",
    marginBottom: 14,
  },
  location: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1D2939",
  },
  arrow: {
    fontSize: 18,
    color: "#98A2B3",
    marginVertical: 5,
  },
  divider: {
    height: 1,
    backgroundColor: "#EAECF0",
    marginVertical: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 8,
  },
  infoLabel: {
    color: "#667085",
    fontSize: 13,
  },
  infoValue: {
    color: "#1D2939",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
    flexShrink: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
  },
  bidCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EAECF0",
    marginBottom: 14,
  },
  bidHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
  },
  bidIdentity: {
    flex: 1,
  },
  bidName: {
    fontSize: 19,
    fontWeight: "800",
    color: "#111827",
  },
  bidTier: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: "800",
    color: "#667085",
  },
  bidAmount: {
    fontSize: 18,
    fontWeight: "900",
    color: "#175CD3",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  stat: {
    flex: 1,
    backgroundColor: "#F7F9FC",
    borderRadius: 12,
    padding: 10,
  },
  statLabel: {
    fontSize: 10,
    color: "#667085",
    fontWeight: "700",
  },
  statValue: {
    marginTop: 4,
    fontSize: 12,
    color: "#1D2939",
    fontWeight: "800",
  },
  vehicleClass: {
    marginTop: 10,
    fontSize: 12,
    color: "#667085",
  },
  messageBox: {
    marginTop: 14,
    backgroundColor: "#F7F9FC",
    borderRadius: 12,
    padding: 12,
  },
  messageLabel: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
    color: "#667085",
  },
  message: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    color: "#344054",
  },
  expires: {
    marginTop: 12,
    fontSize: 11,
    color: "#667085",
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: "#111827",
    borderRadius: 14,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.55,
  },
  empty: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  emptyText: {
    textAlign: "center",
    color: "#667085",
    lineHeight: 21,
    marginTop: 8,
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
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 13,
    marginTop: 10,
  },
  secondaryButtonText: {
    color: "#344054",
    fontWeight: "800",
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#B42318",
  },
  errorText: {
    color: "#667085",
    textAlign: "center",
    marginTop: 7,
  },
  closedNotice: {
    backgroundColor: "#F2F4F7",
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
  },
  closedTitle: {
    fontWeight: "800",
    color: "#344054",
  },
  closedText: {
    marginTop: 5,
    color: "#667085",
    lineHeight: 20,
  },
});
