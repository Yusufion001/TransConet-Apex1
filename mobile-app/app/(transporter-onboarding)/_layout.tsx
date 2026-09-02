import React from "react";
import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuthStore } from "../../src/auth/auth.store";
import { getTransporterOnboardingStatus } from "../../src/api/transporter";

export default function TransporterOnboardingLayout() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const user = useAuthStore((state) => state.user);
  const [ready, setReady] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (!hydrated || !user) return;

    if (user.role !== "TRANSPORTER") {
      setReady(false);
      return;
    }

    let cancelled = false;

    const checkStatus = async () => {
      try {
        const onboarding = await getTransporterOnboardingStatus(user.id);

        if (!cancelled) {
          setReady(onboarding.marketplaceReady);
        }
      } catch (error) {
        console.error(
          "Failed to check transporter onboarding status:",
          error,
        );

        if (!cancelled) {
          setReady(false);
        }
      }
    };

    void checkStatus();

    return () => {
      cancelled = true;
    };
  }, [hydrated, user]);

  if (!hydrated) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (user.role !== "TRANSPORTER") {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (ready === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (ready) {
    return <Redirect href="/(transporter)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
});
