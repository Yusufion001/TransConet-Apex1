import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getWallet,
  initializeWalletFunding,
  type WalletTransaction,
} from "../../../src/api/wallet";
import { useAuthStore } from "../../../src/auth/auth.store";

function formatMoney(value: string | number | undefined) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return "₦0.00";
  }

  return `₦${amount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function transactionLabel(transaction: WalletTransaction) {
  if (transaction.transactionType === "WALLET_FUNDING") {
    return "Wallet funding";
  }

  return (
    transaction.description ||
    transaction.transactionType.replace(/_/g, " ")
  );
}

export default function CustomerWalletScreen() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [fundingReference, setFundingReference] = useState<string | null>(
    null,
  );

  const walletQuery = useQuery({
    queryKey: ["shared-wallet", user?.id],
    queryFn: () => getWallet(user!.id),
    enabled: Boolean(user?.id),
    refetchInterval: 15000,
  });

  const fundingMutation = useMutation({
    mutationFn: (idempotencyKey: string) =>
      initializeWalletFunding({
        amount: Number(amount),
        idempotencyKey,
      }),

    onSuccess: async (funding) => {
      setFundingReference(funding.transactionReference);

      if (!funding.checkoutUrl) {
        Alert.alert(
          "Payment unavailable",
          "The payment checkout could not be created. Please try again.",
        );
        return;
      }

      try {
        if (!(await Linking.canOpenURL(funding.checkoutUrl))) {
          Alert.alert(
            "Unable to open payment",
            "Your device could not open the Flutterwave checkout.",
          );
          return;
        }

        await Linking.openURL(funding.checkoutUrl);
      } catch {
        Alert.alert(
          "Unable to open payment",
          "The payment page could not be opened.",
        );
      }
    },

    onError: (error: unknown) => {
      Alert.alert(
        "Funding failed",
        error instanceof Error
          ? error.message
          : "Unable to initialize wallet funding.",
      );
    },
  });

  useEffect(() => {
    const handleWalletReturn = async ({ url }: { url: string }) => {
      if (!url.startsWith("transconet://wallet-funding-return")) {
        return;
      }

      let status: string | null = null;
      let transactionReference: string | null = fundingReference;

      try {
        const parsed = new URL(url);
        status = parsed.searchParams.get("status");
        transactionReference =
          parsed.searchParams.get("tx_ref") || transactionReference;
      } catch {
        // The backend remains authoritative; refresh the wallet below.
      }

      setFundingReference(transactionReference);

      await queryClient.invalidateQueries({
        queryKey: ["shared-wallet", user?.id],
      });

      if (status === "success") {
        Alert.alert(
          "Wallet funded",
          "Your wallet funding was verified successfully.",
        );
      } else {
        Alert.alert(
          "Funding not completed",
          "The payment was not completed or could not be verified.",
        );
      }
    };

    const subscription = Linking.addEventListener(
      "url",
      handleWalletReturn,
    );

    void Linking.getInitialURL().then((url) => {
      if (url) {
        void handleWalletReturn({ url });
      }
    });

    return () => subscription.remove();
  }, [fundingReference, queryClient, user?.id]);

  const submitFunding = () => {
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      Alert.alert(
        "Invalid amount",
        "Enter an amount greater than ₦0.",
      );
      return;
    }

    if (numericAmount > 100000000) {
      Alert.alert(
        "Amount too high",
        "The maximum wallet funding amount is ₦100,000,000.",
      );
      return;
    }

    fundingMutation.mutate(`mobile-wallet-${Crypto.randomUUID()}`);
  };

  if (walletQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4169E1" />
        <Text style={styles.loadingText}>Loading your wallet…</Text>
      </View>
    );
  }

  if (walletQuery.isError || !walletQuery.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Unable to load wallet</Text>
        <Text style={styles.errorText}>
          Please check your connection and try again.
        </Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() => void walletQuery.refetch()}
        >
          <Text style={styles.primaryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const wallet = walletQuery.data;
  const transactions = wallet.transactions ?? [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <Text style={styles.backText}>‹ Back</Text>
      </Pressable>

      <Text style={styles.eyebrow}>FINANCIALS</Text>
      <Text style={styles.title}>Wallet</Text>
      <Text style={styles.subtitle}>
        Manage your TransConet wallet and fund it securely through Flutterwave.
      </Text>

      <View style={styles.balanceCard}>
        <View style={styles.balanceTop}>
          <View>
            <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
            <Text style={styles.balanceValue}>
              {formatMoney(wallet.availableBalance)}
            </Text>
          </View>

          <View style={styles.walletBadge}>
            <Text style={styles.walletBadgeText}>₦</Text>
          </View>
        </View>

        <View style={styles.pendingRow}>
          <View>
            <Text style={styles.pendingLabel}>PENDING BALANCE</Text>
            <Text style={styles.pendingValue}>
              {formatMoney(wallet.pendingBalance)}
            </Text>
          </View>

          <Pressable
            style={styles.refreshButton}
            onPress={() =>
              void queryClient.invalidateQueries({
                queryKey: ["shared-wallet", user?.id],
              })
            }
          >
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fund Wallet</Text>
        <Text style={styles.sectionText}>
          Successful funding is verified by TransConet before the amount is
          credited to your available balance.
        </Text>

        <Text style={styles.inputLabel}>Amount</Text>

        <View style={styles.amountField}>
          <Text style={styles.currency}>₦</Text>

          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#98A2B3"
            style={styles.amountInput}
            editable={!fundingMutation.isPending}
          />
        </View>

        <Pressable
          style={[
            styles.primaryButton,
            fundingMutation.isPending && styles.disabledButton,
          ]}
          onPress={submitFunding}
          disabled={fundingMutation.isPending}
        >
          {fundingMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Fund Wallet</Text>
          )}
        </Pressable>

        {fundingReference ? (
          <View style={styles.referenceCard}>
            <Text style={styles.referenceLabel}>
              LATEST FUNDING REFERENCE
            </Text>
            <Text style={styles.referenceValue}>
              {fundingReference}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Transaction History</Text>
        <Text style={styles.sectionText}>
          Your wallet activity appears here.
        </Text>

        {transactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptyText}>
              Your wallet activity will appear here after your first
              transaction.
            </Text>
          </View>
        ) : (
          transactions.map((transaction) => {
            const numericAmount = Number(transaction.amount);
            const positive =
              Number.isFinite(numericAmount) && numericAmount >= 0;

            return (
              <View
                key={transaction.id}
                style={styles.transactionCard}
              >
                <View style={styles.transactionIcon}>
                  <Text style={styles.transactionIconText}>
                    {transaction.transactionType === "WALLET_FUNDING"
                      ? "+"
                      : "₦"}
                  </Text>
                </View>

                <View style={styles.transactionMain}>
                  <Text style={styles.transactionTitle}>
                    {transactionLabel(transaction)}
                  </Text>
                  <Text style={styles.transactionDate}>
                    {formatDate(transaction.createdAt)}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.transactionAmount,
                    !positive && styles.negativeAmount,
                  ]}
                >
                  {positive ? "+" : ""}
                  {formatMoney(transaction.amount)}
                </Text>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F7FC",
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F7FC",
    padding: 28,
  },
  loadingText: {
    marginTop: 12,
    color: "#667085",
    fontSize: 14,
    fontWeight: "600",
  },
  errorTitle: {
    color: "#172554",
    fontSize: 21,
    fontWeight: "800",
  },
  errorText: {
    marginTop: 8,
    marginBottom: 20,
    color: "#667085",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 16,
    paddingVertical: 5,
    paddingRight: 12,
  },
  backText: {
    color: "#315AE8",
    fontSize: 15,
    fontWeight: "800",
  },
  eyebrow: {
    color: "#315AE8",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  title: {
    marginTop: 5,
    color: "#14213D",
    fontSize: 32,
    lineHeight: 39,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  subtitle: {
    marginTop: 7,
    color: "#667085",
    fontSize: 14,
    lineHeight: 21,
  },
  balanceCard: {
    marginTop: 22,
    padding: 21,
    borderRadius: 24,
    backgroundColor: "#2448C8",
    elevation: 7,
    shadowColor: "#193AAB",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
  },
  balanceTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  balanceLabel: {
    color: "#DCE6FF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  balanceValue: {
    marginTop: 8,
    color: "#FFFFFF",
    fontSize: 29,
    lineHeight: 37,
    fontWeight: "900",
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  walletBadge: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.17)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  walletBadgeText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },
  pendingRow: {
    marginTop: 21,
    paddingTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
  },
  pendingLabel: {
    color: "#DCE6FF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  pendingValue: {
    marginTop: 5,
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  refreshButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  refreshText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  section: {
    marginTop: 20,
    padding: 17,
    borderWidth: 1,
    borderColor: "#E8EDF6",
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    elevation: 2,
    shadowColor: "#172554",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  sectionTitle: {
    color: "#172554",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  sectionText: {
    marginTop: 6,
    color: "#667085",
    fontSize: 13,
    lineHeight: 20,
  },
  inputLabel: {
    marginTop: 19,
    marginBottom: 8,
    color: "#344054",
    fontSize: 12,
    fontWeight: "800",
  },
  amountField: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#D7E2FA",
    borderRadius: 15,
    backgroundColor: "#F9FBFF",
  },
  currency: {
    color: "#315AE8",
    fontSize: 20,
    fontWeight: "900",
  },
  amountInput: {
    flex: 1,
    marginLeft: 9,
    color: "#172554",
    fontSize: 19,
    fontWeight: "700",
  },
  primaryButton: {
    minHeight: 54,
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: "#315AE8",
    elevation: 2,
    shadowColor: "#315AE8",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  disabledButton: {
    opacity: 0.65,
  },
  referenceCard: {
    marginTop: 13,
    padding: 14,
    borderWidth: 1,
    borderColor: "#D7E2FA",
    borderRadius: 14,
    backgroundColor: "#F3F7FF",
  },
  referenceLabel: {
    color: "#315AE8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  referenceValue: {
    marginTop: 6,
    color: "#172554",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyCard: {
    marginTop: 13,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E6EBF4",
    borderRadius: 16,
    backgroundColor: "#F9FBFF",
  },
  emptyTitle: {
    color: "#344054",
    fontSize: 14,
    fontWeight: "800",
  },
  emptyText: {
    marginTop: 6,
    color: "#667085",
    fontSize: 13,
    lineHeight: 20,
  },
  transactionCard: {
    minHeight: 74,
    marginTop: 9,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E8EDF6",
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
  },
  transactionIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#EEF3FF",
  },
  transactionIconText: {
    color: "#315AE8",
    fontSize: 18,
    fontWeight: "900",
  },
  transactionMain: {
    flex: 1,
    marginLeft: 11,
  },
  transactionTitle: {
    color: "#25324B",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  transactionDate: {
    marginTop: 4,
    color: "#8792A5",
    fontSize: 11,
  },
  transactionAmount: {
    marginLeft: 7,
    color: "#087F68",
    fontSize: 12,
    fontWeight: "900",
    flexShrink: 1,
  },
  negativeAmount: {
    color: "#D92D20",
  },
});
