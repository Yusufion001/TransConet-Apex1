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
