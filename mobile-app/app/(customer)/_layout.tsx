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
            <Ionicons name="person-outline" size={22} color="#0B63CE" />
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
        drawerActiveTintColor: "#0B63CE",
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
    backgroundColor: "#FFFFFF",
  },
  drawerContent: {
    paddingTop: 58,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  brandSection: {
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  brand: {
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "#101828",
  },
  role: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
    color: "#667085",
  },
  welcomeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginBottom: 24,
    borderRadius: 16,
    backgroundColor: "#F2F7FF",
    borderWidth: 1,
    borderColor: "#D9E8FF",
  },
  welcomeIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  welcomeText: {
    flex: 1,
    marginLeft: 11,
  },
  welcomeTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#101828",
  },
  welcomeSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: "#667085",
  },
  sectionLabel: {
    marginHorizontal: 8,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#98A2B3",
  },
  menuItem: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderRadius: 13,
    marginBottom: 4,
  },
  menuItemPressed: {
    backgroundColor: "#F2F4F7",
  },
  iconContainer: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    fontWeight: "700",
    color: "#344054",
  },
  divider: {
    height: 1,
    backgroundColor: "#EAECF0",
    marginVertical: 18,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: "#EAECF0",
    backgroundColor: "#FFFFFF",
  },
  signOutButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderRadius: 13,
  },
  signOutLabel: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    fontWeight: "700",
    color: "#B42318",
  },
});
