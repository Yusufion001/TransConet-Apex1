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
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

export default function TransporterNotifications() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["transporter-notifications", user?.id],
    queryFn: () => getUserNotifications(user!.id),
    enabled: Boolean(user?.id),
  });

  const readMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["transporter-notifications", user?.id],
      });
    },
  });

  const notifications = query.data ?? [];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        <View style={styles.spacer} />
      </View>

      {query.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading notifications...</Text>
        </View>
      ) : query.isError ? (
        <View style={styles.center}>
          <Text style={styles.error}>Unable to load notifications.</Text>
          <Pressable onPress={() => query.refetch()} style={styles.button}>
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.icon}>🔔</Text>
          <Text style={styles.emptyTitle}>No notifications</Text>
          <Text style={styles.muted}>
            Booking, assignment, payment and account updates will appear here.
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
              onPress={() => {
                if (!notification.read) {
                  readMutation.mutate(notification.id);
                }

                if (
                  notification.relatedType === "BOOKING" &&
                  notification.relatedId
                ) {
                  router.push(
                    `/(transporter)/bookings/${notification.relatedId}`,
                  );
                }
              }}
              style={[
                styles.card,
                !notification.read && styles.unread,
              ]}
            >
              <View style={styles.row}>
                <Text style={styles.cardTitle}>{notification.title}</Text>
                {!notification.read && <View style={styles.dot} />}
              </View>

              <Text style={styles.message}>{notification.message}</Text>

              {notification.createdAt && (
                <Text style={styles.date}>
                  {formatDate(notification.createdAt)}
                </Text>
              )}
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
  back: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontSize: 34,
    color: "#111827",
  },
  title: {
    fontSize: 19,
    fontWeight: "800",
    color: "#111827",
  },
  spacer: {
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
  unread: {
    borderColor: "#0B63CE",
  },
  row: {
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
  dot: {
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
  icon: {
    fontSize: 36,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 19,
    fontWeight: "800",
    color: "#111827",
  },
  muted: {
    marginTop: 8,
    textAlign: "center",
    color: "#667085",
    lineHeight: 20,
  },
  error: {
    color: "#B42318",
    fontSize: 16,
    fontWeight: "700",
  },
  button: {
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#111827",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
