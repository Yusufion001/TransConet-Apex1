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
    paddingBottom: 40,
    backgroundColor: "#F7F9FE",
  },
  back: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingVertical: 8,
    paddingRight: 12,
    color: "#4169E1",
    fontSize: 14,
    fontWeight: "700",
  },
  eyebrow: {
    marginTop: 18,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: "#4169E1",
  },
  title: {
    marginTop: 5,
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "800",
    color: "#101B3A",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
  },
  currentCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#17264A",
    borderWidth: 1,
    borderColor: "#24365F",
    marginBottom: 14,
  },
  currentLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.3,
    color: "#B9C5E0",
  },
  currentPlan: {
    marginTop: 7,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  currentStatus: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "600",
    color: "#E0E7F5",
  },
  currentPeriod: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: "#B9C5E0",
  },
  infoCard: {
    padding: 16,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5EAF4",
    marginBottom: 23,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#17233F",
  },
  infoText: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 20,
    color: "#667085",
  },
  sectionTitle: {
    marginBottom: 11,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.3,
    color: "#7A8498",
  },
  planCard: {
    padding: 17,
    marginBottom: 13,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5EAF4",
  },
  currentPlanCard: {
    borderColor: "#4169E1",
    borderWidth: 1.5,
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
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
    color: "#101B3A",
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    overflow: "hidden",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.4,
    color: "#4169E1",
    backgroundColor: "#EEF3FF",
  },
  planPrice: {
    marginLeft: 8,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "800",
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
    marginTop: 13,
    fontSize: 14,
    lineHeight: 21,
    color: "#475467",
  },
  benefits: {
    marginTop: 12,
    paddingTop: 2,
  },
  benefit: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: "#344054",
  },
  noBenefits: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 19,
    color: "#8791A4",
  },
  planButton: {
    marginTop: 17,
    minHeight: 48,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4169E1",
  },
  disabledButton: {
    backgroundColor: "#A7B0C2",
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  planButtonText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.1,
    color: "#FFFFFF",
  },
  message: {
    paddingVertical: 22,
    fontSize: 14,
    lineHeight: 20,
    color: "#667085",
  },
  errorCard: {
    padding: 16,
    borderRadius: 14,
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
    minHeight: 42,
    paddingHorizontal: 17,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4169E1",
  },
  retryText: {
    fontSize: 13,
    fontWeight: "800",
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
