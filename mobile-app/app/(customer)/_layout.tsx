import { Drawer } from "expo-router/drawer";
import { router } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../src/auth/auth.store";

function CustomerDrawerContent(props: any) {
  const signOut = useAuthStore((state) => state.signOut);

  const navigate = (path: string) => {
    props.navigation.closeDrawer();
    router.navigate(path as never);
  };

  const menuItem = (
    label: string,
    path: string,
    icon: React.ComponentProps<typeof Ionicons>["name"],
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.menuItem,
        pressed && styles.menuItemPressed,
      ]}
      onPress={() => navigate(path)}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={21} color="#344054" />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={17} color="#98A2B3" />
    </Pressable>
  );

  const logout = async () => {
    props.navigation.closeDrawer();
    await signOut();
    router.replace("/(auth)/welcome");
  };

  return (
    <View style={styles.drawerContainer}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.drawerContent}
      >
        <View style={styles.brandSection}>
          <Text style={styles.brand}>TRANSCONET</Text>
          <Text style={styles.role}>Customer</Text>
        </View>

        <View style={styles.welcomeCard}>
          <View style={styles.welcomeIcon}>
            <Ionicons name="person-outline" size={22} color="#4169E1" />
          </View>
          <View style={styles.welcomeText}>
            <Text style={styles.welcomeTitle}>Your account</Text>
            <Text style={styles.welcomeSubtitle}>
              Manage your shipments and requests
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>MAIN</Text>

        {menuItem(
          "Command Center",
          "/(customer)",
          "home-outline",
        )}

        {menuItem(
          "My Requests",
          "/(customer)/requests",
          "document-text-outline",
        )}

        {menuItem(
          "My Shipments",
          "/(customer)/bookings",
          "cube-outline",
        )}

        {menuItem(
          "Express Booking",
          "/(customer)/express",
          "flash-outline",
        )}

        {menuItem(
          "Support & Disputes",
          "/(customer)/support-disputes",
          "chatbubbles-outline",
        )}

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>ACCOUNT</Text>

        {menuItem(
          "Wallet",
          "/(customer)/wallet",
          "wallet-outline",
        )}

        {menuItem(
          "Settings",
          "/(customer)/account",
          "settings-outline",
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign Out"
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.menuItemPressed,
          ]}
          onPress={() => void logout()}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="log-out-outline" size={21} color="#B42318" />
          </View>
          <Text style={styles.signOutLabel}>Sign Out</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function CustomerLayout() {
  return (
    <Drawer
      backBehavior="history"
      drawerContent={(props) => <CustomerDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerActiveTintColor: "#4169E1",
        drawerInactiveTintColor: "#475467",
        drawerLabelStyle: {
          fontSize: 15,
          fontWeight: "700",
        },
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          title: "TransConet",
        }}
      />

      <Drawer.Screen
        name="requests"
        options={{
          title: "My Requests",
        }}
      />

      <Drawer.Screen
        name="bookings/index"
        options={{
          title: "My Shipments",
        }}
      />

      <Drawer.Screen
        name="support-disputes"
        options={{
          title: "Support & Disputes",
        }}
      />

      <Drawer.Screen
        name="wallet/index"
        options={{
          title: "Wallet",
        }}
      />

      <Drawer.Screen
        name="account"
        options={{
          title: "Settings",
        }}
      />

      {/* Existing routes retained for deep links/navigation */}
      <Drawer.Screen
        name="support"
        options={{
          drawerItemStyle: { display: "none" },
        }}
      />

      <Drawer.Screen
        name="disputes"
        options={{
          drawerItemStyle: { display: "none" },
        }}
      />

      <Drawer.Screen
        name="notifications/index"
        options={{
          drawerItemStyle: { display: "none" },
        }}
      />

      <Drawer.Screen
        name="bookings/create"
        options={{
          drawerItemStyle: { display: "none" },
        }}
      />

      <Drawer.Screen
        name="express/index"
        options={{
          drawerItemStyle: { display: "none" },
        }}
      />

      <Drawer.Screen
        name="bookings/[id]"
        options={{
          drawerItemStyle: { display: "none" },
        }}
      />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  drawerContainer: {
    flex: 1,
    backgroundColor: "#F4F7FF",
  },
  drawerContent: {
    paddingTop: 48,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  brandSection: {
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  brand: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#101B3A",
  },
  role: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: "#667085",
  },
  welcomeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 11,
    marginBottom: 18,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E4FF",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  welcomeIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF4FF",
  },
  welcomeText: {
    flex: 1,
    marginLeft: 9,
  },
  welcomeTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#101B3A",
  },
  welcomeSubtitle: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
    color: "#667085",
  },
  sectionLabel: {
    marginHorizontal: 8,
    marginBottom: 6,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#98A2B3",
  },
  menuItem: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    borderRadius: 11,
    marginBottom: 2,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EAF4",
  },
  menuItemPressed: {
    backgroundColor: "#EEF4FF",
    borderColor: "#D8E4FF",
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F7FF",
  },
  menuLabel: {
    flex: 1,
    marginLeft: 7,
    fontSize: 14,
    fontWeight: "700",
    color: "#344054",
  },
  divider: {
    height: 1,
    backgroundColor: "#DCE5F5",
    marginVertical: 13,
  },
  footer: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: "#DCE5F5",
    backgroundColor: "#F4F7FF",
  },
  signOutButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0D9D7",
  },
  signOutLabel: {
    flex: 1,
    marginLeft: 7,
    fontSize: 14,
    fontWeight: "700",
    color: "#B42318",
  },
});
