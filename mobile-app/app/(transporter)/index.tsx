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
        <Link href="/(transporter)/bookings" asChild>
          <Pressable style={styles.actionCard}>
            <Text style={styles.icon}>▣</Text>
            <Text style={styles.actionTitle}>Assignments</Text>
            <Text style={styles.actionText}>Manage accepted transport assignments.</Text>
          </Pressable>
        </Link>

        <Link href="/(transporter)/marketplace" asChild>
          <Pressable style={styles.actionCard}>
            <Text style={styles.icon}>⇄</Text>
            <Text style={styles.actionTitle}>Marketplace</Text>
            <Text style={styles.actionText}>Find opportunities and submit bids.</Text>
          </Pressable>
        </Link>
      </View>

      <View style={styles.operationsCard}>
        <Text style={styles.operationsLabel}>TRANSPORTER OPERATIONS</Text>
        <Text style={styles.operationsTitle}>Manage every part of your transport operation</Text>
        <Text style={styles.operationsText}>
          Use ☰ above to access Fleet, Wallet, Notifications, Account and Settings. Accepted bids become assignments, and negotiated assignments may create a separate TransConet commission obligation.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 28,
    paddingBottom: 40,
    backgroundColor: "#F5F7FA",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.7,
    color: "#0B63CE",
  },
  title: {
    marginTop: 6,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    color: "#101828",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 15,
    lineHeight: 22,
    color: "#667085",
  },
  adCard: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#0B63CE",
    marginBottom: 16,
  },
  adLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
    color: "#D1E9FF",
  },
  adTitle: {
    marginTop: 9,
    fontSize: 21,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  adText: {
    marginTop: 7,
    fontSize: 14,
    lineHeight: 21,
    color: "#EAF4FF",
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#98A2B3",
    opacity: 0.55,
  },
  activeDot: {
    width: 18,
    opacity: 1,
    backgroundColor: "#FFFFFF",
  },
  statusCard: {
    padding: 19,
    borderRadius: 18,
    backgroundColor: "#101828",
    marginBottom: 22,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#12B76A",
  },
  statusTitle: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: "#FFFFFF",
  },
  statusText: {
    marginTop: 9,
    fontSize: 14,
    lineHeight: 21,
    color: "#D0D5DD",
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
    minHeight: 145,
    padding: 17,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
  },
  icon: {
    fontSize: 25,
    color: "#0B63CE",
  },
  actionTitle: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: "800",
    color: "#101828",
  },
  actionText: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: "#667085",
  },
  operationsCard: {
    marginTop: 14,
    padding: 19,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
  },
  operationsLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
    color: "#98A2B3",
  },
  operationsTitle: {
    marginTop: 7,
    fontSize: 18,
    fontWeight: "800",
    color: "#101828",
  },
  operationsText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: "#667085",
  },
});
