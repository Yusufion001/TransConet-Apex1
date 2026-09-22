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
        drawerActiveTintColor: "#4169E1",
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
    backgroundColor: "#F4F7FF",
  },

  loadingText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#667085",
  },

  drawer: {
    flexGrow: 1,
    paddingTop: 8,
    paddingBottom: 28,
    backgroundColor: "#FFFFFF",
  },

  brand: {
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 20,
    backgroundColor: "#101B3A",
  },

  brandTitle: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#FFFFFF",
  },

  brandSubtitle: {
    marginTop: 5,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: "#C9D5FF",
  },

  separator: {
    height: 1,
    backgroundColor: "#E8ECF5",
    marginHorizontal: 18,
    marginVertical: 9,
  },

  menuItem: {
    minHeight: 54,
    marginHorizontal: 10,
    marginVertical: 3,
    paddingHorizontal: 15,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  menuLabel: {
    marginLeft: 13,
    fontSize: 15,
    fontWeight: "700",
    color: "#344054",
  },

  headerBalance: {
    marginRight: 10,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 11,
    overflow: "hidden",
    backgroundColor: "#EEF3FF",
    fontSize: 13,
    fontWeight: "900",
    color: "#101B3A",
  },

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 4,
  },

  headerIconButton: {
    width: 42,
    height: 42,
    marginRight: 2,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F7FF",
    position: "relative",
  },

  notificationBadge: {
    position: "absolute",
    top: 1,
    right: -1,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D92D20",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  notificationBadgeText: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "900",
    color: "#FFFFFF",
  },
});
