import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
            <Text style={styles.badgeText}>{formatStatus(request)}</Text>
          </View>
          <Text style={styles.id}>#{request.id.slice(0, 8)}</Text>
        </View>

        <Text style={styles.location}>{request.pickupLocation}</Text>
        <Text style={styles.arrow}>↓</Text>
        <Text style={styles.location}>{request.destination}</Text>

        <View style={styles.details}>
          <Text style={styles.detail}>
            {request.truckCategory.replaceAll("_", " ")}
          </Text>
          {request.cargoWeight != null && (
            <Text style={styles.detail}>
              {request.cargoWeight} kg
            </Text>
          )}
          <Text style={styles.detail}>
            {request.bids.length} bid{request.bids.length === 1 ? "" : "s"}
          </Text>
        </View>

        <Text style={styles.date}>
          {new Date(request.createdAt).toLocaleDateString()}
        </Text>
      </Pressable>

      {isPending && (
        <Pressable
          onPress={() => onCancel(request)}
          style={styles.cancelButton}
        >
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
      <Text style={styles.title}>My Requests</Text>
      <Text style={styles.subtitle}>
        View your marketplace requests and manage pending requests.
      </Text>

      {requests.length === 0 ? (
        <View style={styles.empty}>
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
              <Text style={styles.sectionTitle}>{section}</Text>

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
    padding: 24,
    backgroundColor: "#F7F9FC",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#111827",
    marginTop: 24,
  },
  subtitle: {
    fontSize: 15,
    color: "#667085",
    marginTop: 8,
    marginBottom: 24,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 10,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EAECF0",
  },
  cardContent: {
    width: "100%",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#EFF8FF",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#175CD3",
  },
  id: {
    fontSize: 12,
    color: "#98A2B3",
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
  details: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  detail: {
    fontSize: 12,
    color: "#667085",
  },
  date: {
    marginTop: 12,
    fontSize: 12,
    color: "#98A2B3",
  },
  cancelButton: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#FDA29B",
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#B42318",
    fontWeight: "800",
  },
  empty: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  emptyText: {
    textAlign: "center",
    color: "#667085",
    lineHeight: 21,
    marginVertical: 10,
  },
  button: {
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
    marginTop: 12,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  error: {
    color: "#B42318",
    fontSize: 16,
    marginBottom: 10,
  },
});
