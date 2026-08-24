import { Drawer } from "expo-router/drawer";

export default function TransporterLayout() {
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
          drawerLabel: "Operations Center",
          title: "TransConet",
        }}
      />

      <Drawer.Screen
        name="marketplace/index"
        options={{
          drawerLabel: "Capacity Exchange",
          title: "Capacity Exchange",
        }}
      />

      <Drawer.Screen
        name="bookings/index"
        options={{
          drawerLabel: "Assignments",
          title: "Assignments",
        }}
      />

      <Drawer.Screen
        name="vehicles/index"
        options={{
          drawerLabel: "Fleet",
          title: "Fleet",
        }}
      />

      <Drawer.Screen
        name="marketplace/[id]"
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
