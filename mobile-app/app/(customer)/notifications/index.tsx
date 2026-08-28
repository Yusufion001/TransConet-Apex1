import React from "react";
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

  const notifications = query.data ?? [];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <Text style={styles.title}>Notifications</Text>

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
    backgroundColor: "#F7F9FC",
  },
  header: {
    minHeight: 72,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E4E7EC",
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontSize: 34,
    lineHeight: 38,
    color: "#111827",
  },
  title: {
    fontSize: 19,
    fontWeight: "800",
    color: "#111827",
  },
  headerSpacer: {
    width: 44,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
  },
  unreadCard: {
    borderColor: "#0B63CE",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#0B63CE",
    marginLeft: 10,
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#475467",
  },
  date: {
    marginTop: 10,
    fontSize: 12,
    color: "#98A2B3",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  loadingText: {
    marginTop: 10,
    color: "#667085",
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 19,
    fontWeight: "800",
    color: "#111827",
  },
  emptyText: {
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
    color: "#667085",
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#B42318",
  },
  retryButton: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#0B63CE",
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
