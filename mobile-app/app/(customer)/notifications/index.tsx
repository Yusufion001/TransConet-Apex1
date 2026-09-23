import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getUserNotifications,
  markNotificationAsRead,
  type Notification,
} from "../../../src/api/notifications";
import { useAuthStore } from "../../../src/auth/auth.store";
import { getRealtimeSocket } from "../../../src/realtime/socket";

function formatDate(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString();
}

export default function CustomerNotifications() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["customer-notifications", user?.id],
    queryFn: () => getUserNotifications(user!.id),
    enabled: Boolean(user?.id),
  });

  const readMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["customer-notifications", user?.id],
      });
    },
  });

  useEffect(() => {
    if (!user?.id) return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    void getRealtimeSocket()
      .then((socket) => {
        if (cancelled) return;

        const handleNotificationCreated = (event: {
          recipientId?: string;
        }) => {
          if (event.recipientId === user.id) {
            void queryClient.invalidateQueries({
              queryKey: ["customer-notifications", user.id],
            });
          }
        };

        socket.on("notification:created", handleNotificationCreated);

        cleanup = () => {
          socket.off("notification:created", handleNotificationCreated);
        };
      })
      .catch(() => {
        // Notification polling/fetching remains available if realtime is unavailable.
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [user?.id, queryClient]);

  const notifications = query.data ?? [];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.eyebrow}>UPDATES</Text>
          <Text style={styles.title}>Notifications</Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      {query.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : query.isError ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>
            Unable to load notifications
          </Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => query.refetch()}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>No notifications</Text>
          <Text style={styles.emptyText}>
            New booking, trip, payment and account updates will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {notifications.map((notification: Notification) => (
            <Pressable
              key={notification.id}
              disabled={notification.read || readMutation.isPending}
              onPress={() => {
                if (!notification.read) {
                  readMutation.mutate(notification.id);
                }

                if (
                  notification.relatedType === "BOOKING" &&
                  notification.relatedId
                ) {
                  router.push(
                    `/(customer)/bookings/${notification.relatedId}`,
                  );
                } else if (notification.relatedType === "SUPPORT_TICKET") {
                  router.push("/(customer)/support");
                }
              }}
              style={[
                styles.card,
                !notification.read && styles.unreadCard,
              ]}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>
                  {notification.title}
                </Text>

                {!notification.read ? (
                  <View style={styles.unreadDot} />
                ) : null}
              </View>

              <Text style={styles.message}>
                {notification.message}
              </Text>

              {notification.createdAt ? (
                <Text style={styles.date}>
                  {formatDate(notification.createdAt)}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F4F7FF",
  },
  header: {
    minHeight: 82,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E1E7F0",
  },
  headerTitleWrap: {
    flex: 1,
    marginHorizontal: 10,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#4169E1",
    marginBottom: 3,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF4FF",
  },
  backText: {
    fontSize: 32,
    lineHeight: 36,
    color: "#4169E1",
    marginTop: -2,
  },
  title: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "900",
    color: "#101B3A",
  },
  headerSpacer: {
    width: 44,
  },
  list: {
    padding: 20,
    paddingBottom: 36,
    gap: 13,
  },
  card: {
    padding: 18,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE5F5",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.045,
    shadowRadius: 12,
    elevation: 2,
  },
  unreadCard: {
    borderColor: "#4169E1",
    backgroundColor: "#FBFCFF",
    shadowOpacity: 0.08,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
    color: "#101B3A",
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#4169E1",
    marginLeft: 12,
    marginTop: 4,
  },
  message: {
    marginTop: 9,
    fontSize: 14,
    lineHeight: 21,
    color: "#475467",
  },
  date: {
    marginTop: 12,
    fontSize: 11,
    fontWeight: "700",
    color: "#98A2B3",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  loadingText: {
    marginTop: 12,
    color: "#667085",
    fontSize: 14,
  },
  emptyIcon: {
    fontSize: 38,
    opacity: 0.85,
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: "900",
    color: "#101B3A",
  },
  emptyText: {
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
    color: "#667085",
  },
  errorTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#101B3A",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 16,
    minHeight: 48,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4169E1",
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 3,
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
