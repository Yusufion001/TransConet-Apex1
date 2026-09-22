import { Link } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated } from "react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../src/auth/auth.store";
import { getUserNotifications } from "../../src/api/notifications";

export default function TransporterHome() {
  const user = useAuthStore((state) => state.user);

  const firstName = user?.firstName?.trim() || "Transporter";

  const notificationsQuery = useQuery({
    queryKey: ["transporter-home-notifications", user?.id],
    queryFn: () => getUserNotifications(user!.id),
    enabled: Boolean(user?.id),
  });

  const advertisements = (notificationsQuery.data ?? []).filter((item) =>
    ["MARKETING", "ADVERTISEMENT", "ANNOUNCEMENT", "PROMOTION"].includes(
      item.type.toUpperCase(),
    ),
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (advertisements.length <= 1) {
      setActiveIndex(0);
      return;
    }

    const timer = setInterval(() => {
      Animated.sequence([
        Animated.timing(fade, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
      ]).start();

      setActiveIndex((current) => (current + 1) % advertisements.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [advertisements.length, fade]);

  const advertisement = advertisements[activeIndex];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>TRANSPORTER</Text>
      <Text style={styles.title}>Welcome back, {firstName}</Text>
      <Text style={styles.subtitle}>
        Manage your transport operations and stay connected to new opportunities.
      </Text>

      {advertisement ? (
        <Animated.View style={[styles.adCard, { opacity: fade }]}>
          <Text style={styles.adLabel}>TRANSCONET • {advertisement.type}</Text>

          <Text style={styles.adTitle}>{advertisement.title}</Text>

          <Text style={styles.adText}>{advertisement.message}</Text>

          {advertisements.length > 1 ? (
            <View style={styles.dots}>
              {advertisements.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.dot,
                    index === activeIndex && styles.activeDot,
                  ]}
                />
              ))}
            </View>
          ) : null}
        </Animated.View>
      ) : null}

      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusTitle}>NETWORK READY</Text>
        </View>

        <Text style={styles.statusText}>
          Your transporter operations center is ready for the next movement.
        </Text>
      </View>

      <Text style={styles.sectionLabel}>QUICK ACCESS</Text>

      <View style={styles.grid}>
        <Link href="/(transporter)/assignments" asChild>
          <Pressable style={styles.actionCard}>
            <Text style={styles.icon}>▣</Text>
            <Text style={styles.actionTitle}>My Assignments</Text>
            <Text style={styles.actionText}>
              Manage Marketplace and Express shipments from one place.
            </Text>
          </Pressable>
        </Link>

        <Link href="/(transporter)/jobs" asChild>
          <Pressable style={styles.actionCard}>
            <Text style={styles.icon}>⇄</Text>
            <Text style={styles.actionTitle}>Browse Jobs</Text>
            <Text style={styles.actionText}>
              Find Marketplace and Express transport opportunities.
            </Text>
          </Pressable>
        </Link>
      </View>

      <View style={styles.operationsCard}>
        <Text style={styles.operationsLabel}>TRANSPORTER OPERATIONS</Text>
        <Text style={styles.operationsTitle}>Manage every part of your transport operation</Text>
        <Text style={styles.operationsText}>
          Use the drawer to access Fleet, Wallet, Support & Disputes, and Settings. Notifications are available from the bell in the top bar. Manage assignments and browse jobs from their consolidated screens.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 44,
    backgroundColor: "#F4F7FF",
  },
  eyebrow: {
    alignSelf: "flex-start",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#E8EEFF",
    color: "#4169E1",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  title: {
    marginTop: 14,
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "900",
    color: "#101B3A",
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 22,
    color: "#667085",
    maxWidth: 470,
  },
  adCard: {
    padding: 21,
    borderRadius: 22,
    backgroundColor: "#4169E1",
    marginBottom: 15,
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4,
  },
  adLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
    color: "#DCE6FF",
  },
  adTitle: {
    marginTop: 10,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  adText: {
    marginTop: 7,
    fontSize: 14,
    lineHeight: 21,
    color: "#EEF3FF",
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 17,
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    opacity: 0.4,
  },
  activeDot: {
    width: 19,
    opacity: 1,
    backgroundColor: "#FFFFFF",
  },
  statusCard: {
    padding: 19,
    borderRadius: 20,
    backgroundColor: "#101B3A",
    marginBottom: 24,
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 3,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#12B76A",
  },
  statusTitle: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: "#FFFFFF",
  },
  statusText: {
    marginTop: 9,
    fontSize: 14,
    lineHeight: 21,
    color: "#E1E7F5",
  },
  sectionLabel: {
    marginBottom: 12,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: "#667085",
  },
  grid: {
    flexDirection: "row",
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minHeight: 154,
    padding: 17,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7F2",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 13,
    elevation: 2,
  },
  icon: {
    width: 42,
    height: 42,
    fontSize: 23,
    lineHeight: 42,
    textAlign: "center",
    borderRadius: 13,
    overflow: "hidden",
    color: "#4169E1",
    backgroundColor: "#EAF0FF",
  },
  actionTitle: {
    marginTop: 13,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
    color: "#101B3A",
  },
  actionText: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: "#667085",
  },
  operationsCard: {
    marginTop: 14,
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7F2",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 13,
    elevation: 2,
  },
  operationsLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
    color: "#4169E1",
  },
  operationsTitle: {
    marginTop: 8,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "900",
    color: "#101B3A",
  },
  operationsText: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 20,
    color: "#667085",
  },
});
