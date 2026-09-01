import React, { useState } from "react";
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
} from "../../../src/api/wallet";
import { useAuthStore } from "../../../src/auth/auth.store";

function money(value: string | number | undefined) {
  if (value === undefined || value === null || value === "") return "0";
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : String(value);
}

export default function TransporterWallet() {
  const user = useAuthStore((state) => state.user);
  const [amount, setAmount] = useState("");

  const query = useQuery({
    queryKey: ["transporter-wallet", user?.id],
    queryFn: () => getTransporterWallet(user!.id),
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
      query.refetch();
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

  if (query.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Loading wallet...</Text>
      </View>
    );
  }

  if (query.isError || !query.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Unable to load wallet.</Text>
        <Pressable onPress={() => query.refetch()} style={styles.button}>
          <Text style={styles.buttonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const wallet = query.data;

  const submitWithdrawal = () => {
    const value = Number(amount);

    if (!amount.trim() || !Number.isFinite(value) || value <= 0) {
      Alert.alert("Invalid amount", "Enter a valid withdrawal amount.");
      return;
    }

    Alert.alert(
      "Confirm withdrawal",
      `Request withdrawal of ${money(value)}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => withdrawalMutation.mutate(),
        },
      ],
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>

      <Text style={styles.eyebrow}>FINANCIALS</Text>
      <Text style={styles.title}>Transporter Wallet</Text>
      <Text style={styles.subtitle}>
        Monitor your available earnings and request withdrawals.
      </Text>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
        <Text style={styles.balance}>
          {money(wallet.availableBalance ?? wallet.balance)}
        </Text>
        <Text style={styles.currency}>
          {wallet.currency ?? "NGN"}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>WALLET OVERVIEW</Text>

        <InfoRow
          label="Current balance"
          value={money(wallet.balance)}
        />

        <InfoRow
          label="Available balance"
          value={money(wallet.availableBalance ?? wallet.balance)}
        />

        <InfoRow
          label="Pending balance"
          value={money(wallet.pendingBalance)}
        />

        <InfoRow
          label="Total earned"
          value={money(wallet.totalEarned)}
        />

        {wallet.status && (
          <InfoRow label="Status" value={wallet.status} />
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

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
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
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F4F7",
  },
  infoLabel: {
    color: "#667085",
    fontSize: 14,
  },
  infoValue: {
    color: "#101828",
    fontWeight: "800",
    fontSize: 14,
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
  error: {
    color: "#B42318",
    fontSize: 16,
    fontWeight: "700",
  },
  muted: {
    marginTop: 8,
    color: "#667085",
  },
});
