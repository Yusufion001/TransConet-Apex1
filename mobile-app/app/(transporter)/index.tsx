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
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 36,
    backgroundColor: "#F8FAFF",
  },
  eyebrow: {

    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#EAF0FF",
    color: "#4169E1",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  title: {

    marginTop: 15,
    fontSize: 29,
    lineHeight: 36,
    fontWeight: "800",
    color: "#101B3A",
    letterSpacing: -0.5,
  },
  subtitle: {

    marginTop: 7,
    marginBottom: 22,
    fontSize: 14,
    lineHeight: 22,
    color: "#667085",
    maxWidth: 470,
  },
  adCard: {

    padding: 18,
    borderRadius: 16,
    backgroundColor: "#4169E1",
    marginBottom: 24,
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 7,
    elevation: 1,
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

    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 18,
    borderRadius: 0,
    backgroundColor: "transparent",
    marginBottom: 25,
    borderBottomWidth: 1,
    borderBottomColor: "#E1E7F2",
    shadowOpacity: 0,
    elevation: 0,
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
    letterSpacing: 1.2,
    color: "#344054",
  },
  statusText: {

    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
  },
  sectionLabel: {

    marginBottom: 14,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
    color: "#667085",
  },
  grid: {

    flexDirection: "row",
    gap: 18,
  },
  actionCard: {

    flex: 1,
    minHeight: 145,
    padding: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  icon: {

    width: 40,
    height: 40,
    fontSize: 22,
    lineHeight: 40,
    textAlign: "center",
    borderRadius: 11,
    overflow: "hidden",
    color: "#4169E1",
    backgroundColor: "#EAF0FF",
  },
  actionTitle: {

    marginTop: 12,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
    color: "#101B3A",
  },
  actionText: {

    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: "#667085",
  },
  operationsCard: {

    marginTop: 20,
    padding: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  operationsLabel: {

    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "#4169E1",
  },
  operationsTitle: {

    marginTop: 7,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "800",
    color: "#101B3A",
  },
  operationsText: {

    marginTop: 7,
    fontSize: 13,
    lineHeight: 20,
    color: "#667085",
  },
});
