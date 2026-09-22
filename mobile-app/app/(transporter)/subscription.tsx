import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  createSubscription,
  getMySubscription,
  getSubscriptionPlans,
  type SubscriptionPlan,
  type TransporterSubscription,
} from "../../src/api/subscriptions";

function formatPrice(plan: SubscriptionPlan) {
  const amount = Number(plan.price);
  const currency = plan.currency?.toUpperCase();

  if (!Number.isFinite(amount)) {
    return `${currency === "NGN" ? "₦" : currency} ${String(plan.price)}`;
  }

  if (currency === "NGN") {
    return `₦${amount.toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function benefitsFor(plan: SubscriptionPlan) {
  return Array.isArray(plan.features?.benefits)
    ? plan.features.benefits
    : [];
}

export default function TransporterSubscription() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] =
    useState<TransporterSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [availablePlans, currentSubscription] = await Promise.all([
        getSubscriptionPlans(),
        getMySubscription(),
      ]);

      setPlans(availablePlans);
      setSubscription(currentSubscription);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load subscription plans.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const choosePlan = async (plan: SubscriptionPlan) => {
    if (selectedPlanId) return;

    if (plan.name === "FREE") {
      Alert.alert(
        "FREE Plan",
        plan.description ||
          "The FREE plan is available without a subscription payment.",
      );
      return;
    }

    if (subscription?.status === "ACTIVE" || subscription?.status === "PAST_DUE") {
      Alert.alert(
        "Subscription Active",
        "You already have an active subscription. Cancel or wait for the current subscription period to end before selecting another plan.",
      );
      return;
    }

    Alert.alert(
      plan.name,
      `${formatPrice(plan)} / ${plan.interval === "MONTHLY" ? "month" : "year"}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue to Payment",
          onPress: () => void startPayment(plan),
        },
      ],
    );
  };

  const startPayment = async (plan: SubscriptionPlan) => {
    try {
      setSelectedPlanId(plan.id);
      setError("");

      const result = await createSubscription(plan.id);

      if (!result.checkoutUrl) {
        Alert.alert(
          "Payment Unavailable",
          "The payment checkout could not be created. Please try again.",
        );
        return;
      }

      await WebBrowser.openBrowserAsync(result.checkoutUrl);
      await loadData();
    } catch (requestError) {
      Alert.alert(
        "Subscription Payment",
        requestError instanceof Error
          ? requestError.message
          : "Unable to start subscription payment.",
      );
    } finally {
      setSelectedPlanId(null);
    }
  };

  const currentPlanName = subscription?.plan?.name ?? "FREE";
  const currentStatus = subscription?.status ?? "NOT_SUBSCRIBED";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>

      <Text style={styles.eyebrow}>TRANSCONET</Text>
      <Text style={styles.title}>Subscription & Visibility</Text>
      <Text style={styles.subtitle}>
        Choose a transporter subscription to increase marketplace visibility.
      </Text>

      <View style={styles.currentCard}>
        <Text style={styles.currentLabel}>CURRENT SUBSCRIPTION</Text>
        <Text style={styles.currentPlan}>{currentPlanName}</Text>
        <Text style={styles.currentStatus}>
          Status: {currentStatus.replaceAll("_", " ")}
        </Text>

        {subscription?.currentPeriodEnd ? (
          <Text style={styles.currentPeriod}>
            Current period ends{" "}
            {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
          </Text>
        ) : null}
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Marketplace visibility</Text>
        <Text style={styles.infoText}>
          Your subscription level affects how your transporter account is
          ranked when suitable marketplace loads are matched to your vehicle.
          The visibility rules and subscription benefits are controlled by
          TransConet administrators.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>AVAILABLE PLANS</Text>

      {loading ? (
        <Text style={styles.message}>Loading subscription plans...</Text>
      ) : error && plans.length === 0 ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadData()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : plans.length === 0 ? (
        <Text style={styles.message}>
          No subscription plans are currently available.
        </Text>
      ) : (
        plans.map((plan) => {
          const benefits = benefitsFor(plan);
          const isCurrent = subscription?.planId === plan.id;
          const isSelected = selectedPlanId === plan.id;

          return (
            <View
              key={plan.id}
              style={[styles.planCard, isCurrent && styles.currentPlanCard]}
            >
              <View style={styles.planHeader}>
                <View style={styles.planTitleWrap}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  {isCurrent ? (
                    <Text style={styles.currentBadge}>CURRENT</Text>
                  ) : null}
                </View>

                <Text style={styles.planPrice}>{formatPrice(plan)}</Text>
              </View>

              <Text style={styles.interval}>
                {plan.interval === "MONTHLY" ? "per month" : "per year"}
              </Text>

              {plan.description ? (
                <Text style={styles.planDescription}>{plan.description}</Text>
              ) : null}

              {benefits.length > 0 ? (
                <View style={styles.benefits}>
                  {benefits.map((benefit, index) => (
                    <Text key={`${plan.id}-benefit-${index}`} style={styles.benefit}>
                      • {benefit}
                    </Text>
                  ))}
                </View>
              ) : (
                <Text style={styles.noBenefits}>
                  No additional benefits have been configured.
                </Text>
              )}

              <Pressable
                disabled={Boolean(selectedPlanId) || isCurrent}
                onPress={() => void choosePlan(plan)}
                style={({ pressed }) => [
                  styles.planButton,
                  isCurrent && styles.disabledButton,
                  pressed && !isCurrent && styles.buttonPressed,
                ]}
              >
                <Text style={styles.planButtonText}>
                  {isCurrent
                    ? "Current Plan"
                    : isSelected
                      ? "Opening Payment..."
                      : plan.name === "FREE"
                        ? "View FREE Plan"
                        : "Choose Plan"}
                </Text>
              </Pressable>
            </View>
          );
        })
      )}

      {error && plans.length > 0 ? (
        <Text style={styles.inlineError}>{error}</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 48,
    backgroundColor: "#F4F7FF",
  },

  back: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingVertical: 8,
    paddingRight: 12,
    color: "#4169E1",
    fontSize: 15,
    fontWeight: "800",
  },

  eyebrow: {
    marginTop: 22,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.6,
    color: "#4169E1",
  },

  title: {
    marginTop: 5,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: "900",
    color: "#101B3A",
  },

  subtitle: {
    marginTop: 8,
    marginBottom: 22,
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
  },

  currentCard: {
    padding: 20,
    borderRadius: 22,
    backgroundColor: "#101B3A",
    borderWidth: 1,
    borderColor: "#1C2A50",
    marginBottom: 14,
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 5,
  },

  currentLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#AAB6D3",
  },

  currentPlan: {
    marginTop: 7,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  currentStatus: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "700",
    color: "#DCE3F5",
  },

  currentPeriod: {
    marginTop: 5,
    fontSize: 12,
    color: "#AAB6D3",
  },

  infoCard: {
    padding: 19,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7F5",
    marginBottom: 25,
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },

  infoTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#101B3A",
  },

  infoText: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 20,
    color: "#667085",
  },

  sectionTitle: {
    marginBottom: 11,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: "#667085",
  },

  planCard: {
    padding: 19,
    marginBottom: 15,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7F5",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },

  currentPlanCard: {
    borderColor: "#4169E1",
    borderWidth: 2,
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 15,
    elevation: 4,
  },

  planHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  planTitleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    paddingRight: 10,
  },

  planName: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "900",
    color: "#101B3A",
  },

  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
    color: "#4169E1",
    backgroundColor: "#EEF3FF",
  },

  planPrice: {
    marginLeft: 8,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
    color: "#101B3A",
  },

  interval: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "600",
    color: "#667085",
    textAlign: "right",
  },

  planDescription: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 21,
    color: "#475467",
  },

  benefits: {
    marginTop: 13,
    paddingTop: 2,
  },

  benefit: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: "#344054",
  },

  noBenefits: {
    marginTop: 13,
    fontSize: 13,
    lineHeight: 19,
    color: "#98A2B3",
  },

  planButton: {
    marginTop: 18,
    minHeight: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4169E1",
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 9,
    elevation: 3,
  },

  disabledButton: {
    backgroundColor: "#A7B0C2",
    shadowOpacity: 0,
    elevation: 0,
  },

  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },

  planButtonText: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.2,
    color: "#FFFFFF",
  },

  message: {
    paddingVertical: 22,
    fontSize: 14,
    lineHeight: 20,
    color: "#667085",
  },

  errorCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: "#FFF6F5",
    borderWidth: 1,
    borderColor: "#F3C7C2",
  },

  errorText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#B42318",
  },

  retryButton: {
    marginTop: 13,
    alignSelf: "flex-start",
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4169E1",
  },

  retryText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  inlineError: {
    marginTop: 3,
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 19,
    color: "#B42318",
  },
});
