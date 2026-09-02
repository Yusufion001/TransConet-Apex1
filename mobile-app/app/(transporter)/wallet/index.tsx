import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getTransporterWallet,
  requestWithdrawal,
  type WalletTransaction,
} from "../../../src/api/wallet";
import { getTransporterBookings } from "../../../src/api/bookings";
import { useAuthStore } from "../../../src/auth/auth.store";

function money(value: string | number | undefined) {
  if (value === undefined || value === null || value === "") return "0";
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString() : String(value);
}

function transactionLabel(type: string) {
  switch (type) {
    case "PAYMENT_PENDING":
      return "Payment pending";
    case "SETTLEMENT_RELEASED":
      return "Earnings released";
    case "WITHDRAWAL_PENDING":
      return "Withdrawal requested";
    default:
      return type.replace(/_/g, " ");
  }
}

function transactionStatus(type: string) {
  switch (type) {
    case "PAYMENT_PENDING":
      return "PENDING";
    case "SETTLEMENT_RELEASED":
      return "RELEASED";
    case "WITHDRAWAL_PENDING":
      return "PENDING";
    default:
      return "RECORDED";
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function TransporterWallet() {
  const user = useAuthStore((state) => state.user);
  const [amount, setAmount] = useState("");

  const walletQuery = useQuery({
    queryKey: ["transporter-wallet", user?.id],
    queryFn: () => getTransporterWallet(user!.id),
    enabled: Boolean(user?.id),
    refetchInterval: 15000,
  });

  const bookingsQuery = useQuery({
    queryKey: ["transporter-wallet-trips", user?.id],
    queryFn: () => getTransporterBookings(user!.id),
    enabled: Boolean(user?.id),
  });

  const withdrawalMutation = useMutation({
    mutationFn: () =>
      requestWithdrawal({
        amount: Number(amount),
        transporterId: user!.id,
      }),
    onSuccess: () => {
      setAmount("");
      walletQuery.refetch();
      Alert.alert(
        "Withdrawal requested",
        "Your withdrawal request has been submitted.",
      );
    },
    onError: (error: unknown) => {
      Alert.alert(
        "Withdrawal failed",
        error instanceof Error
          ? error.message
          : "Unable to submit withdrawal.",
      );
    },
  });

  const transactions = walletQuery.data?.transactions ?? [];
  const withdrawals = walletQuery.data?.withdrawals ?? [];

  const releasedEarnings = useMemo(
    () =>
      transactions
        .filter((item) => item.transactionType === "SETTLEMENT_RELEASED")
        .reduce((sum, item) => sum + Number(item.amount), 0),
    [transactions],
  );

  const completedTrips = useMemo(
    () =>
      (bookingsQuery.data ?? []).filter(
        (booking) => booking.status === "COMPLETED",
      ),
    [bookingsQuery.data],
  );

  const paymentTransactions = useMemo(
    () =>
      transactions.filter(
        (item) =>
          item.transactionType === "PAYMENT_PENDING" ||
          item.transactionType === "SETTLEMENT_RELEASED",
      ),
    [transactions],
  );

  const submitWithdrawal = () => {
    const value = Number(amount);
    const available = Number(walletQuery.data?.availableBalance ?? 0);

    if (!amount.trim() || !Number.isFinite(value) || value <= 0) {
      Alert.alert("Invalid amount", "Enter a valid withdrawal amount.");
      return;
    }

    if (value > available) {
      Alert.alert(
        "Insufficient balance",
        "The withdrawal amount is greater than your available balance.",
      );
      return;
    }

    Alert.alert(
      "Confirm withdrawal",
      `Request withdrawal of ₦${money(value)}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => withdrawalMutation.mutate(),
        },
      ],
    );
  };

  if (!user?.id) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Transporter session unavailable.</Text>
      </View>
    );
  }

  if (walletQuery.isLoading || bookingsQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Loading financial history...</Text>
      </View>
    );
  }

  if (walletQuery.isError || !walletQuery.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Unable to load wallet.</Text>
        <Pressable
          onPress={() => {
            walletQuery.refetch();
            bookingsQuery.refetch();
          }}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const wallet = walletQuery.data;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>

      <Text style={styles.eyebrow}>FINANCIALS</Text>
      <Text style={styles.title}>Earnings & History</Text>
      <Text style={styles.subtitle}>
        Track released earnings, pending payments, completed trips and
        withdrawals.
      </Text>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>AVAILABLE EARNINGS</Text>
        <Text style={styles.balance}>
          ₦{money(wallet.availableBalance)}
        </Text>
        <Text style={styles.currency}>NGN</Text>
      </View>

      <View style={styles.summaryGrid}>
        <SummaryCard
          label="Pending"
          value={`₦${money(wallet.pendingBalance)}`}
        />
        <SummaryCard
          label="Released"
          value={`₦${money(releasedEarnings)}`}
        />
        <SummaryCard
          label="Completed trips"
          value={String(completedTrips.length)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>EARNINGS TRANSACTIONS</Text>

        {transactions.length === 0 ? (
          <Empty text="No earnings transactions recorded yet." />
        ) : (
          transactions.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
            />
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>COMPLETED TRIPS</Text>

        {completedTrips.length === 0 ? (
          <Empty text="No completed trips yet." />
        ) : (
          completedTrips.map((booking) => (
            <Pressable
              key={booking.id}
              style={styles.tripRow}
              onPress={() =>
                router.push(
                  `/(transporter)/bookings/${booking.id}` as never,
                )
              }
            >
              <View style={styles.tripMain}>
                <Text style={styles.tripRoute} numberOfLines={2}>
                  {booking.pickupLocation} → {booking.destination}
                </Text>
                <Text style={styles.tripMeta}>
                  Completed {formatDate(booking.completedAt ?? booking.updatedAt)}
                </Text>
              </View>

              <View style={styles.tripAmount}>
                <Text style={styles.tripFare}>
                  ₦{money(booking.fare ?? booking.estimatedFare ?? "0")}
                </Text>
                <Text style={styles.tripStatus}>
                  {booking.paymentStatus}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>PAYMENT HISTORY</Text>

        {paymentTransactions.length === 0 ? (
          <Empty text="No payment history recorded yet." />
        ) : (
          paymentTransactions.map((transaction) => (
            <TransactionRow
              key={`payment-${transaction.id}`}
              transaction={transaction}
            />
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>WITHDRAWAL HISTORY</Text>

        {withdrawals.length === 0 ? (
          <Empty text="No withdrawals requested yet." />
        ) : (
          withdrawals.map((withdrawal) => (
            <View key={withdrawal.id} style={styles.withdrawalRow}>
              <View>
                <Text style={styles.withdrawalTitle}>
                  ₦{money(withdrawal.amount)}
                </Text>
                <Text style={styles.tripMeta}>
                  {withdrawal.accountNumber
                    ? `Account ${withdrawal.accountNumber}`
                    : "Bank withdrawal"}
                </Text>
                <Text style={styles.tripMeta}>
                  {formatDate(withdrawal.createdAt)}
                </Text>
              </View>

              <Text style={styles.status}>{withdrawal.status}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>REQUEST WITHDRAWAL</Text>

        <Text style={styles.label}>Amount</Text>

        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="Enter amount"
          placeholderTextColor="#98A2B3"
          keyboardType="decimal-pad"
          style={styles.input}
        />

        <Pressable
          disabled={withdrawalMutation.isPending}
          onPress={submitWithdrawal}
          style={[
            styles.button,
            withdrawalMutation.isPending && styles.disabled,
          ]}
        >
          {withdrawalMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Request Withdrawal</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function TransactionRow({
  transaction,
}: {
  transaction: WalletTransaction;
}) {
  const released = transaction.transactionType === "SETTLEMENT_RELEASED";

  return (
    <View style={styles.transactionRow}>
      <View style={styles.transactionMain}>
        <Text style={styles.transactionTitle}>
          {transactionLabel(transaction.transactionType)}
        </Text>

        <Text style={styles.transactionDescription} numberOfLines={2}>
          {transaction.description ?? "Financial transaction"}
        </Text>

        <Text style={styles.tripMeta}>
          {formatDate(transaction.createdAt)}
          {transaction.bookingId
            ? ` • Booking ${transaction.bookingId.slice(0, 8)}`
            : ""}
        </Text>
      </View>

      <View style={styles.transactionAmount}>
        <Text
          style={[
            styles.amount,
            released ? styles.positive : styles.neutral,
          ]}
        >
          {released ? "+" : ""}
          ₦{money(transaction.amount)}
        </Text>

        <Text style={styles.status}>
          {transactionStatus(transaction.transactionType)}
        </Text>
      </View>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 50,
    backgroundColor: "#F7F9FC",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  back: {
    color: "#0B63CE",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 12,
  },
  eyebrow: {
    marginTop: 24,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.6,
    color: "#0B63CE",
  },
  title: {
    marginTop: 5,
    fontSize: 30,
    fontWeight: "800",
    color: "#101828",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 21,
    color: "#667085",
    marginBottom: 22,
  },
  balanceCard: {
    padding: 24,
    borderRadius: 20,
    backgroundColor: "#101828",
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: "#98A2B3",
  },
  balance: {
    marginTop: 10,
    fontSize: 34,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  currency: {
    marginTop: 4,
    color: "#D0D5DD",
    fontWeight: "700",
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    padding: 14,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
  },
  summaryLabel: {
    fontSize: 11,
    color: "#667085",
    fontWeight: "700",
  },
  summaryValue: {
    marginTop: 7,
    fontSize: 15,
    color: "#101828",
    fontWeight: "900",
  },
  card: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    marginBottom: 16,
  },
  section: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: "#667085",
    marginBottom: 14,
  },
  transactionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F4F7",
    gap: 12,
  },
  transactionMain: {
    flex: 1,
  },
  transactionTitle: {
    color: "#101828",
    fontSize: 14,
    fontWeight: "800",
  },
  transactionDescription: {
    marginTop: 3,
    color: "#667085",
    fontSize: 12,
    lineHeight: 17,
  },
  transactionAmount: {
    alignItems: "flex-end",
  },
  amount: {
    fontSize: 14,
    fontWeight: "900",
  },
  positive: {
    color: "#067647",
  },
  neutral: {
    color: "#344054",
  },
  status: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "800",
    color: "#667085",
  },
  tripRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F4F7",
    gap: 12,
  },
  tripMain: {
    flex: 1,
  },
  tripRoute: {
    color: "#101828",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
  },
  tripMeta: {
    marginTop: 4,
    color: "#667085",
    fontSize: 11,
  },
  tripAmount: {
    alignItems: "flex-end",
  },
  tripFare: {
    color: "#101828",
    fontSize: 14,
    fontWeight: "900",
  },
  tripStatus: {
    marginTop: 4,
    color: "#067647",
    fontSize: 10,
    fontWeight: "800",
  },
  withdrawalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F4F7",
  },
  withdrawalTitle: {
    color: "#101828",
    fontSize: 15,
    fontWeight: "900",
  },
  label: {
    color: "#344054",
    fontWeight: "700",
    marginBottom: 7,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: "#101828",
  },
  button: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: "#0B63CE",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.6,
  },
  empty: {
    color: "#667085",
    fontSize: 13,
    lineHeight: 19,
    paddingVertical: 8,
  },
  muted: {
    marginTop: 10,
    color: "#667085",
  },
  error: {
    color: "#B42318",
    textAlign: "center",
    marginBottom: 15,
  },
});
