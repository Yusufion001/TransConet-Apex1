import { Drawer } from "expo-router/drawer";
import { Pressable, ScrollView, Text, View, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../src/auth/auth.store";
import { getTransporterWallet } from "../../src/api/wallet";

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
      {money(query.data?.availableBalance ?? query.data?.balance)}
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
      <Drawer.Screen name="settings" options={{ title: "Settings" }} />
      <Drawer.Screen name="marketplace/[id]" options={{ drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="bookings/[id]" options={{ drawerItemStyle: { display: "none" } }} />
    </Drawer>
  );
}

const styles = StyleSheet.create({
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
