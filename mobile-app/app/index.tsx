import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useEffect, useState } from "react";
import { useAuthStore } from "../src/auth/auth.store";
import { getTransporterOnboardingStatus } from "../src/api/transporter";

export default function Index() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const user = useAuthStore((state) => state.user);
  const [transporterRoute, setTransporterRoute] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated || !user || user.role !== "TRANSPORTER") {
      return;
    }

    let cancelled = false;

    const resolveTransporterRoute = async () => {
      try {
        const onboarding = await getTransporterOnboardingStatus(user.id);

        if (cancelled) return;

        if (onboarding.marketplaceReady) {
          setTransporterRoute("/(transporter)");
          return;
        }

        switch (onboarding.currentStep) {
          case "PROFILE_SETUP":
            setTransporterRoute("/(transporter-onboarding)/profile");
            break;
          case "DOCUMENTS":
          case "IDENTITY_VERIFICATION":
            setTransporterRoute("/(transporter-onboarding)/documents");
            break;
          case "VEHICLE":
            setTransporterRoute("/(transporter-onboarding)/vehicle");
            break;
          case "ADMIN_REVIEW":
          case "TIER_2_DOCUMENTS":
          case "TIER_2_REVIEW":
          case "APPROVED":
            setTransporterRoute("/(transporter-onboarding)/review");
            break;
          case "EMAIL_VERIFICATION":
            setTransporterRoute("/(auth)/verify-email");
            break;
          default:
            setTransporterRoute("/(transporter-onboarding)/profile");
        }
      } catch (error) {
        console.error(
          "Failed to resolve transporter onboarding route:",
          error,
        );

        if (!cancelled) {
          setTransporterRoute("/(transporter-onboarding)/profile");
        }
      }
    };

    void resolveTransporterRoute();

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
    return <Redirect href="/(auth)/welcome" />;
  }

  if (user.role === "CUSTOMER") {
    return <Redirect href="/(customer)" />;
  }

  if (user.role === "TRANSPORTER") {
    if (!transporterRoute) {
      return (
        <View style={styles.container}>
          <ActivityIndicator size="large" />
        </View>
      );
    }

    return <Redirect href={transporterRoute as any} />;
  }

  return <Redirect href="/(auth)/welcome" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
