import { Drawer } from "expo-router/drawer";

export default function CustomerLayout() {
  return (
    <Drawer
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
          drawerLabel: "Command Center",
          title: "TransConet",
        }}
      />
      <Drawer.Screen
        name="requests"
        options={{
          drawerLabel: "My Requests",
          title: "My Requests",
        }}
      />
      <Drawer.Screen
        name="support"
        options={{
          drawerLabel: "Support",
          title: "Support",
        }}
      />
      <Drawer.Screen
        name="notifications/index"
        options={{
          drawerLabel: "Notifications",
          title: "Notifications",
        }}
      />
      <Drawer.Screen
        name="account"
        options={{
          drawerLabel: "Account",
          title: "Account",
        }}
      />
      <Drawer.Screen
        name="bookings/index"
        options={{
          drawerLabel: "My Shipments",
          title: "My Shipments",
        }}
      />
      <Drawer.Screen
        name="bookings/create"
        options={{
          drawerLabel: "Book Transport",
          title: "Book Transport",
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
