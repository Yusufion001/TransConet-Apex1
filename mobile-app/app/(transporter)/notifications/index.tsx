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
    backgroundColor: "#F4F7FF",
  },
  header: {
    minHeight: 76,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E1E7F5",
    shadowColor: "#101B3A",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F4FF",
  },
  backText: {
    marginTop: -3,
    fontSize: 31,
    fontWeight: "400",
    color: "#101B3A",
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: "#101B3A",
  },
  spacer: {
    width: 44,
  },
  list: {
    padding: 18,
    paddingBottom: 40,
    gap: 13,
  },
  card: {
    padding: 18,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7F5",
    shadowColor: "#101B3A",
    shadowOpacity: 0.04,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  unread: {
    borderColor: "#4169E1",
    borderLeftWidth: 4,
    paddingLeft: 15,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
    color: "#101B3A",
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#4169E1",
    marginLeft: 12,
  },
  message: {
    marginTop: 9,
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
  },
  date: {
    marginTop: 13,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: "#E8ECF5",
    fontSize: 11,
    fontWeight: "700",
    color: "#98A2B3",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    backgroundColor: "#F4F7FF",
  },
  icon: {
    width: 64,
    height: 64,
    marginBottom: 3,
    textAlign: "center",
    fontSize: 35,
    lineHeight: 64,
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: "#E9EFFF",
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900",
    color: "#101B3A",
  },
  muted: {
    marginTop: 9,
    maxWidth: 320,
    textAlign: "center",
    color: "#667085",
    fontSize: 14,
    lineHeight: 21,
  },
  error: {
    color: "#B42318",
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  button: {
    minHeight: 48,
    marginTop: 17,
    paddingHorizontal: 22,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4169E1",
    shadowColor: "#4169E1",
    shadowOpacity: 0.16,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
});
