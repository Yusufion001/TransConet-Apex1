import { Stack } from "expo-router";
import { useEffect } from "react";
import { useAuthStore } from "../src/auth/auth.store";
import { QueryProvider } from "../src/providers/query-provider";

export default function RootLayout() {
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <QueryProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
        }}
      />
    </QueryProvider>
  );
}
