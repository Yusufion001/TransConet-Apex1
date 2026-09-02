import { Redirect, router } from "expo-router";
import { Drawer } from "expo-router/drawer";
import React from "react";
import { Pressable, ScrollView, Text, View, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../src/auth/auth.store";
import { getTransporterWallet } from "../../src/api/wallet";
import { getTransporterOnboardingStatus } from "../../src/api/transporter";

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

function TransporterDrawerContent(props: any) {
  const signOut = useAuthStore((state) => state.signOut);

  const go = (path: string) => {
    router.push(path as never);
  };

  const logout = async () => {
    await signOut();
    router.replace("/(auth)/sign-in");
  };

  const item = (label: string, path: string) => (
    <Pressable
      style={styles.menuItem}
      onPress={() => {
        props.navigation.closeDrawer();
        go(path);
      }}
    >
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

      {item("⌂  Home", "/(transporter)")}
      {item("▣  Assignments", "/(transporter)/bookings")}
      {item("⇄  Marketplace", "/(transporter)/marketplace")}
      {item("🚚  Fleet", "/(transporter)/vehicles")}
      {item("₦  Wallet", "/(transporter)/wallet")}
      {item("🔔  Notifications", "/(transporter)/notifications")}
      {item("👤  Account", "/(transporter)/account")}
      {item("🆘  Support", "/(transporter)/support")}
      {item("⚖  Disputes", "/(transporter)/disputes")}

      <View style={styles.separator} />

      {item("⚙  Settings", "/(transporter)/settings")}

      <Pressable
        style={styles.menuItem}
        onPress={() => void logout()}
      >
        <Text style={styles.menuLabel}>↪  Sign Out</Text>
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

        if (onboarding.marketplaceReady) {
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
          case "APPROVED":
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
      drawerContent={(props) => <TransporterDrawerContent {...props} />}
      screenOptions={{
        headerShown: true,
        headerTitle: "TRANSCONET",
        headerTitleAlign: "left",
        headerRight: () => <HeaderBalance />,
        drawerActiveTintColor: "#0B63CE",
        drawerInactiveTintColor: "#475467",
        drawerLabelStyle: {
          fontSize: 15,
          fontWeight: "700",
        },
      }}
    >
      <Drawer.Screen name="index" options={{ title: "Home" }} />
      <Drawer.Screen name="bookings/index" options={{ title: "Assignments" }} />
      <Drawer.Screen name="marketplace/index" options={{ title: "Marketplace" }} />
      <Drawer.Screen name="vehicles/index" options={{ title: "Fleet" }} />
      <Drawer.Screen name="wallet/index" options={{ title: "Wallet" }} />
      <Drawer.Screen name="notifications/index" options={{ title: "Notifications" }} />
      <Drawer.Screen name="account" options={{ title: "Account" }} />
      <Drawer.Screen name="support" options={{ title: "Support" }} />
      <Drawer.Screen name="disputes" options={{ title: "Disputes" }} />
      <Drawer.Screen name="settings" options={{ title: "Settings" }} />
      <Drawer.Screen name="marketplace/[id]" options={{ drawerItemStyle: { display: "none" } }} />
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
