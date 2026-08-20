import { Stack } from "expo-router";
import { useEffect } from "react";
import { useAuthStore } from "../src/auth/auth.store";

export default function RootLayout() {
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
      }}
    />
  );
}
