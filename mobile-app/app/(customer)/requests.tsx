import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../src/auth/auth.store";
import {
  cancelMarketplaceRequest,
  getCustomerMarketplaceRequests,
  type MarketplaceRequest,
} from "../../src/api/marketplace";

const PENDING_STATUSES = new Set(["OPEN", "BIDDING_CLOSED"]);

function getRequestSection(request: MarketplaceRequest) {
  if (request.status === "CANCELLED") {
    return "Cancelled";
  }

  if (
    request.status === "AGREED" &&
    request.bookingStatus === "COMPLETED"
  ) {
    return "Successful";
  }

  if (
    request.status === "AGREED" &&
    request.bookingStatus !== "COMPLETED" &&
    request.bookingStatus !== "CANCELLED"
  ) {
    return "Active";
  }

  if (PENDING_STATUSES.has(request.status)) {
    return "Pending";
  }

  return "Cancelled";
}

function formatStatus(request: MarketplaceRequest) {
  if (request.status === "AGREED") {
    if (request.bookingStatus === "COMPLETED") {
      return "Successful";
    }

    return "Active";
  }

  if (request.status === "CANCELLED") {
    return "Cancelled";
  }

  return request.status;
}

function RequestCard({
  request,
  onCancel,
  onOpen,
}: {
  request: MarketplaceRequest;
  onCancel: (request: MarketplaceRequest) => void;
  onOpen: (request: MarketplaceRequest) => void;
}) {
  const isPending = PENDING_STATUSES.has(request.status);

  return (
    <View style={styles.card}>
      <Pressable onPress={() => onOpen(request)} style={styles.cardContent}>
        <View style={styles.row}>
          <View style={styles.badge}>
            <Ionicons name="radio-button-on" size={11} color="#4169E1" />
            <Text style={styles.badgeText}>{formatStatus(request)}</Text>
          </View>
          <Text style={styles.id}>#{request.id.slice(0, 8)}</Text>
        </View>

        <View style={styles.routeBlock}>
          <View style={styles.routeIconColumn}>
            <View style={styles.routeDot} />
            <View style={styles.routeLine} />
            <Ionicons name="location" size={16} color="#4169E1" />
          </View>
          <View style={styles.routeTextColumn}>
            <Text style={styles.routeLabel}>PICKUP</Text>
            <Text style={styles.location}>{request.pickupLocation}</Text>
            <View style={styles.routeGap} />
            <Text style={styles.routeLabel}>DESTINATION</Text>
            <Text style={styles.location}>{request.destination}</Text>
          </View>
        </View>

        <View style={styles.details}>
          <View style={styles.detailPill}>
            <Ionicons name="car-outline" size={14} color="#667085" />
            <Text style={styles.detail}>
              {request.truckCategory.replaceAll("_", " ")}
            </Text>
          </View>
          {request.cargoWeight != null && (
            <View style={styles.detailPill}>
              <Ionicons name="scale-outline" size={14} color="#667085" />
              <Text style={styles.detail}>{request.cargoWeight} kg</Text>
            </View>
          )}
          <View style={styles.detailPill}>
            <Ionicons name="pricetags-outline" size={14} color="#667085" />
            <Text style={styles.detail}>
              {request.bids.length} bid{request.bids.length === 1 ? "" : "s"}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.date}>
            {new Date(request.createdAt).toLocaleDateString()}
          </Text>
          <View style={styles.openAction}>
            <Text style={styles.openActionText}>View</Text>
            <Ionicons name="arrow-forward" size={15} color="#4169E1" />
          </View>
        </View>
      </Pressable>

      {isPending && (
        <Pressable
          onPress={() => onCancel(request)}
          style={styles.cancelButton}
        >
          <Ionicons name="close-circle-outline" size={17} color="#B42318" />
          <Text style={styles.cancelButtonText}>Cancel Request</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function CustomerRequests() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const query = useQuery({
    queryKey: ["customer-marketplace-requests", user?.id],
    queryFn: getCustomerMarketplaceRequests,
    enabled: Boolean(user?.id),
  });

  const handleCancel = (request: MarketplaceRequest) => {
    Alert.alert(
      "Cancel Request",
      "Are you sure you no longer want this marketplace request?",
      [
        { text: "Keep Request", style: "cancel" },
        {
          text: "Cancel Request",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelMarketplaceRequest(request.id);
              await query.refetch();
            } catch (error) {
              Alert.alert(
                "Unable to cancel request",
                error instanceof Error
                  ? error.message
                  : "Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  if (query.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (query.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Unable to load your requests.</Text>
        <Pressable onPress={() => query.refetch()} style={styles.button}>
          <Text style={styles.buttonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const requests = query.data ?? [];
  const sections = ["Pending", "Active", "Successful", "Cancelled"];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.eyebrow}>
          <Ionicons name="layers-outline" size={13} color="#4169E1" />
          <Text style={styles.eyebrowText}>MARKETPLACE</Text>
        </View>
        <Text style={styles.title}>My Requests</Text>
        <Text style={styles.subtitle}>
          View your marketplace requests and manage pending requests.
        </Text>
      </View>

      {requests.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="layers-outline" size={28} color="#4169E1" />
          </View>
          <Text style={styles.emptyTitle}>No requests yet</Text>
          <Text style={styles.emptyText}>
            Create a marketplace request to start receiving transporter bids.
          </Text>
          <Pressable
            onPress={() => router.push("/(customer)/bookings/create")}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Book Transport</Text>
          </Pressable>
        </View>
      ) : (
        sections.map((section) => {
          const sectionRequests = requests.filter(
            (request) => getRequestSection(request) === section,
          );

          if (sectionRequests.length === 0) {
            return null;
          }

          return (
            <View key={section} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section}</Text>
                <View style={styles.sectionLine} />
              </View>

              {sectionRequests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  onCancel={handleCancel}
                  onOpen={(item) =>
                    router.push(`/(customer)/marketplace/${item.id}`)
                  }
                />
              ))}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 36,
    backgroundColor: "#F4F7FF",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F4F7FF",
  },
  header: {
    marginTop: 20,
    marginBottom: 18,
  },
  eyebrow: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EAF0FF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  eyebrowText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#4169E1",
  },
  title: {
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "800",
    color: "#101B3A",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
    marginTop: 7,
    maxWidth: 360,
  },
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 11,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#101B3A",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#DDE5F5",
    marginLeft: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 17,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: "#E7ECF6",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  cardContent: {
    width: "100%",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 17,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#EAF0FF",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#4169E1",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  id: {
    fontSize: 11,
    fontWeight: "700",
    color: "#98A2B3",
  },
  routeBlock: {
    flexDirection: "row",
    minHeight: 116,
  },
  routeIconColumn: {
    width: 25,
    alignItems: "center",
    paddingTop: 5,
  },
  routeDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#4169E1",
  },
  routeLine: {
    width: 1,
    flex: 1,
    backgroundColor: "#C7D4F2",
    marginVertical: 4,
  },
  routeTextColumn: {
    flex: 1,
    paddingLeft: 9,
  },
  routeLabel: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.9,
    color: "#98A2B3",
    marginBottom: 3,
  },
  location: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: "#1D2939",
  },
  routeGap: {
    height: 18,
  },
  details: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 15,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "#F0F2F5",
  },
  detailPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F7F9FC",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  detail: {
    fontSize: 11,
    fontWeight: "700",
    color: "#667085",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
  },
  date: {
    fontSize: 11,
    color: "#98A2B3",
  },
  openAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  openActionText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#4169E1",
  },
  cancelButton: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: "#FDA29B",
    backgroundColor: "#FFF7F6",
    borderRadius: 13,
    paddingVertical: 11,
  },
  cancelButtonText: {
    color: "#B42318",
    fontSize: 12,
    fontWeight: "800",
  },
  empty: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E7ECF6",
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF0FF",
    marginBottom: 13,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#101B3A",
  },
  emptyText: {
    textAlign: "center",
    color: "#667085",
    lineHeight: 21,
    marginVertical: 9,
  },
  button: {
    backgroundColor: "#4169E1",
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
    marginTop: 12,
    minWidth: 160,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  error: {
    color: "#B42318",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 10,
  },
});
