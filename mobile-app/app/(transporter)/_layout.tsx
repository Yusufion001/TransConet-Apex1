import { Redirect, router } from "expo-router";
import { Drawer } from "expo-router/drawer";
import React from "react";
import { Pressable, ScrollView, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../src/auth/auth.store";
import { getTransporterWallet } from "../../src/api/wallet";
import { getUserNotifications } from "../../src/api/notifications";
import { getTransporterOnboardingStatus } from "../../src/api/transporter";
import { listenForExpressOffers } from "../../src/realtime/express-realtime";

function money(value: string | number | undefined) {
  if (value === undefined || value === null || value === "") return "₦0";
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `₦${amount.toLocaleString()}`
    : `₦${String(value)}`;
}

function HeaderBalance() {
  const user = useAuthStore((state) => state.user);

  const query = useQuery({
    queryKey: ["transporter-header-wallet", user?.id],
    queryFn: () => getTransporterWallet(user!.id),
    enabled: Boolean(user?.id),
    refetchInterval: 15000,
  });

  return (
    <Text style={styles.headerBalance}>
      {money(query.data?.availableBalance)}
    </Text>
  );
}

function HeaderActions() {
  const user = useAuthStore((state) => state.user);
  const notificationsQuery = useQuery({
    queryKey: ["transporter-header-notifications", user?.id],
    queryFn: () => getUserNotifications(user!.id),
    enabled: Boolean(user?.id),
    refetchInterval: 30000,
  });

  const unreadCount =
    notificationsQuery.data?.filter((notification) => !notification.read).length ?? 0;

  return (
    <View style={styles.headerActions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        hitSlop={10}
        style={styles.headerIconButton}
        onPress={() => router.navigate("/(transporter)/notifications" as never)}
      >
        <Ionicons name="notifications-outline" size={24} color="#374151" />
        {unreadCount > 0 && (
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </Text>
          </View>
        )}
      </Pressable>
      <HeaderBalance />
    </View>
  );
}

function TransporterDrawerContent(props: any) {
  const signOut = useAuthStore((state) => state.signOut);

  const go = (path: string) => {
    router.navigate(path as never);
  };

  const logout = async () => {
    await signOut();
    router.replace("/(auth)/sign-in");
  };

  const item = (
    label: string,
    path: string,
    icon: React.ComponentProps<typeof Ionicons>["name"],
  ) => (
    <Pressable
      style={styles.menuItem}
      onPress={() => {
        props.navigation.closeDrawer();
        go(path);
      }}
    >
      <Ionicons name={icon} size={24} color="#4B5563" />
      <Text style={styles.menuLabel}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView contentContainerStyle={styles.drawer}>
      <View style={styles.brand}>
        <Text style={styles.brandTitle}>TRANSCONET</Text>
        <Text style={styles.brandSubtitle}>Transporter</Text>
      </View>

      <View style={styles.separator} />

      {item("Home", "/(transporter)", "home-outline")}
      {item("My Assignments", "/(transporter)/assignments", "briefcase-outline")}
      {item("Browse Jobs", "/(transporter)/jobs", "search-outline")}
      {item("Fleet", "/(transporter)/vehicles", "car-outline")}
      {item("Wallet", "/(transporter)/wallet", "wallet-outline")}
      {item("Support & Disputes", "/(transporter)/support", "help-circle-outline")}

      <View style={styles.separator} />

      {item("Settings", "/(transporter)/settings", "settings-outline")}

      <Pressable
        style={styles.menuItem}
        onPress={() => void logout()}
      >
        <Ionicons name="log-out-outline" size={24} color="#4B5563" />
        <Text style={styles.menuLabel}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

export default function TransporterLayout() {
  const user = useAuthStore((state) => state.user);
  const [route, setRoute] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user || user.role !== "TRANSPORTER") {
      setRoute("/(auth)/sign-in");
      return;
    }

    let cancelled = false;

    const checkOnboarding = async () => {
      try {
        const onboarding = await getTransporterOnboardingStatus(user.id);

        if (cancelled) return;

        if (onboarding.marketplaceReady || onboarding.currentStep === "APPROVED") {
          setRoute("READY");
          return;
        }

        switch (onboarding.currentStep) {
          case "PROFILE_SETUP":
            setRoute("/(transporter-onboarding)/profile");
            break;
          case "DOCUMENTS":
          case "IDENTITY_VERIFICATION":
            setRoute("/(transporter-onboarding)/documents");
            break;
          case "VEHICLE":
            setRoute("/(transporter-onboarding)/vehicle");
            break;
          case "ADMIN_REVIEW":
          case "TIER_2_DOCUMENTS":
          case "TIER_2_REVIEW":
            setRoute("/(transporter-onboarding)/review");
            break;
          case "EMAIL_VERIFICATION":
            setRoute("/(auth)/verify-email");
            break;
          default:
            setRoute("/(transporter-onboarding)/profile");
        }
      } catch (error) {
        console.error("Failed to check transporter onboarding:", error);

        if (!cancelled) {
          setRoute("/(transporter-onboarding)/profile");
        }
      }
    };

    void checkOnboarding();

    return () => {
      cancelled = true;
    };
  }, [user]);

  React.useEffect(() => {
    if (route !== "READY" || !user || user.role !== "TRANSPORTER") {
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void listenForExpressOffers((event) => {
      if (cancelled || !event.data?.expressBookingId) {
        return;
      }

      router.navigate(
        `/(transporter)/express/${event.data.expressBookingId}` as never,
      );
    }).then((cleanup) => {
      if (cancelled) {
        cleanup();
        return;
      }
      unsubscribe = cleanup;
    }).catch((error) => {
      console.error("Failed to subscribe to Express offers:", error);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [route, user]);

  if (!route) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Checking onboarding...</Text>
      </View>
    );
  }

  if (route !== "READY") {
    return <Redirect href={route as any} />;
  }

  return (
    <Drawer
      backBehavior="history"
      drawerContent={(props) => <TransporterDrawerContent {...props} />}
      screenOptions={{
        headerShown: true,
        headerTitle: "TRANSCONET",
        headerTitleAlign: "left",
        headerRight: () => <HeaderActions />,
        drawerActiveTintColor: "#0B63CE",
        drawerInactiveTintColor: "#475467",
        drawerLabelStyle: {
          fontSize: 15,
          fontWeight: "700",
        },
      }}
    >
      <Drawer.Screen name="index" options={{ title: "Home" }} />
      <Drawer.Screen name="assignments/index" options={{ title: "My Assignments" }} />
      <Drawer.Screen name="jobs/index" options={{ title: "Browse Jobs" }} />
      <Drawer.Screen
        name="assignments/marketplace"
        options={{ drawerItemStyle: { display: "none" } }}
      />
      <Drawer.Screen
        name="assignments/express"
        options={{ drawerItemStyle: { display: "none" } }}
      />
      <Drawer.Screen name="marketplace-assignments/index" options={{ drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="express-assignments/index" options={{ drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="marketplace/index" options={{ drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="express/index" options={{ drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="vehicles/index" options={{ title: "Fleet" }} />
      <Drawer.Screen name="wallet/index" options={{ title: "Wallet" }} />
      <Drawer.Screen name="notifications/index" options={{ drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="account" options={{ drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="support" options={{ title: "Support & Disputes" }} />
      <Drawer.Screen name="disputes" options={{ drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="settings" options={{ title: "Settings" }} />
      <Drawer.Screen name="marketplace/[id]" options={{ drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="express/[id]" options={{ drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="bookings/[id]" options={{ drawerItemStyle: { display: "none" } }} />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  loadingText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#667085",
  },
  drawer: {
    paddingBottom: 24,
  },
  menuItem: {
    minHeight: 50,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#475467",
  },
  headerBalance: {
    marginRight: 16,
    fontSize: 14,
    fontWeight: "800",
    color: "#101828",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: 2,
    right: 0,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  brand: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "#101828",
  },
  brandSubtitle: {
    marginTop: 3,
    fontSize: 13,
    color: "#667085",
    fontWeight: "600",
  },
  separator: {
    height: 1,
    backgroundColor: "#EAECF0",
    marginVertical: 10,
  },
});
