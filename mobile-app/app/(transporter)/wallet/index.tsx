import React, { useMemo, useState } from "react";
import * as Crypto from "expo-crypto";
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
  createWithdrawalAccount,
  createWithdrawalAccountChallenge,
  getTransporterWallet,
  getWithdrawalAccounts,
  requestWithdrawal,
  type WithdrawalAccount,
  type WithdrawalSecurityPurpose,
  type WalletTransaction,
} from "../../../src/api/wallet";
import { getTransporterBookings } from "../../../src/api/bookings";
import { useAuthStore } from "../../../src/auth/auth.store";

function money(value: string | number | undefined) {
  if (value === undefined || value === null || value === "") return "0";
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString()
    : String(value);
}

function transactionLabel(type: string) {
  switch (type) {
    case "PAYMENT_PENDING":
      return "Payment pending";
    case "SETTLEMENT_RELEASED":
      return "Earnings released";
    case "WITHDRAWAL_PENDING":
      return "Withdrawal requested";
    case "WITHDRAWAL_COMPLETED":
      return "Withdrawal completed";
    case "WITHDRAWAL_REFUNDED":
      return "Withdrawal refunded";
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
    case "WITHDRAWAL_COMPLETED":
      return "COMPLETED";
    case "WITHDRAWAL_REFUNDED":
      return "REFUNDED";
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

function formatCooldown(value: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime()) ||
    date.getTime() <= Date.now()
  ) {
    return null;
  }

  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isAccountUsable(account: WithdrawalAccount) {
  if (account.status !== "VERIFIED") return false;

  if (
    account.securityCooldownUntil &&
    new Date(account.securityCooldownUntil).getTime() >
      Date.now()
  ) {
    return false;
  }

  return true;
}

export default function TransporterWallet() {
  const user = useAuthStore((state) => state.user);

  const [amount, setAmount] = useState("");
  const [selectedAccountId, setSelectedAccountId] =
    useState("");

  const [accountMode, setAccountMode] =
    useState<WithdrawalSecurityPurpose | null>(null);
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

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

  const accountsQuery = useQuery({
    queryKey: [
      "transporter-withdrawal-accounts",
      user?.id,
    ],
    queryFn: () => getWithdrawalAccounts(user!.id),
    enabled: Boolean(user?.id),
    refetchInterval: 15000,
  });

  const withdrawalMutation = useMutation({
    mutationFn: (idempotencyKey: string) =>
      requestWithdrawal({
        amount: Number(amount),
        withdrawalAccountId: selectedAccountId,
        idempotencyKey,
      }),

    onSuccess: () => {
      setAmount("");
      walletQuery.refetch();
      accountsQuery.refetch();

      Alert.alert(
        "Withdrawal requested",
        "Your withdrawal request has been submitted and is pending processing.",
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

  const challengeMutation = useMutation({
    mutationFn: (purpose: WithdrawalSecurityPurpose) =>
      createWithdrawalAccountChallenge(purpose),

    onSuccess: (challenge) => {
      setChallengeId(challenge.challengeId);
      setOtp("");

      Alert.alert(
        "Security code sent",
        "A verification code has been sent to your verified phone number.",
      );
    },

    onError: (error: unknown) => {
      Alert.alert(
        "Security verification",
        error instanceof Error
          ? error.message
          : "Unable to start security verification.",
      );
    },
  });

  const accountMutation = useMutation({
    mutationFn: () =>
      createWithdrawalAccount({
        challengeId,
        pin: otp,
        bankCode: bankCode.trim(),
        accountNumber: accountNumber.trim(),
      }),

    onSuccess: (account) => {
      setAccountMode(null);
      setChallengeId("");
      setOtp("");
      setBankCode("");
      setAccountNumber("");

      accountsQuery.refetch();

      if (account.isDefault) {
        setSelectedAccountId(account.id);
      }

      Alert.alert(
        "Bank account verified",
        account.securityCooldownUntil
          ? "Your new default account has been added. Withdrawals to it are temporarily locked for security."
          : "Your bank account has been securely verified and added.",
      );
    },

    onError: (error: unknown) => {
      Alert.alert(
        "Account verification failed",
        error instanceof Error
          ? error.message
          : "Unable to verify this bank account.",
      );
    },
  });

  const transactions =
    walletQuery.data?.transactions ?? [];
  const withdrawals =
    walletQuery.data?.withdrawals ?? [];
  const accounts = accountsQuery.data ?? [];

  const defaultAccount = useMemo(
    () => accounts.find((account) => account.isDefault),
    [accounts],
  );

  const selectedAccount = useMemo(
    () =>
      accounts.find(
        (account) => account.id === selectedAccountId,
      ) ?? defaultAccount,
    [accounts, selectedAccountId, defaultAccount],
  );

  const releasedEarnings = useMemo(
    () =>
      transactions
        .filter(
          (item) =>
            item.transactionType ===
            "SETTLEMENT_RELEASED",
        )
        .reduce(
          (sum, item) => sum + Number(item.amount),
          0,
        ),
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
          item.transactionType ===
            "SETTLEMENT_RELEASED",
      ),
    [transactions],
  );

  const startAccountSecurity = (
    purpose: WithdrawalSecurityPurpose,
  ) => {
    setAccountMode(purpose);
    setChallengeId("");
    setOtp("");
    setBankCode("");
    setAccountNumber("");

    challengeMutation.mutate(purpose);
  };

  const submitAccount = () => {
    if (!challengeId) {
      Alert.alert(
        "Security verification required",
        "Request and enter the security code first.",
      );
      return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      Alert.alert(
        "Invalid security code",
        "Enter the 6-digit verification code sent to your phone.",
      );
      return;
    }

    if (!/^\d{3}$/.test(bankCode.trim())) {
      Alert.alert(
        "Invalid bank code",
        "Enter the 3-digit Nigerian bank code.",
      );
      return;
    }

    if (!/^\d{10}$/.test(accountNumber.trim())) {
      Alert.alert(
        "Invalid account number",
        "Enter a valid 10-digit Nigerian bank account number.",
      );
      return;
    }

    accountMutation.mutate();
  };

  const submitWithdrawal = () => {
    const value = Number(amount);
    const available = Number(
      walletQuery.data?.availableBalance ?? 0,
    );

    const account =
      accounts.find(
        (item) => item.id === selectedAccountId,
      ) ?? defaultAccount;

    if (
      !amount.trim() ||
      !Number.isFinite(value) ||
      value <= 0
    ) {
      Alert.alert(
        "Invalid amount",
        "Enter a valid withdrawal amount.",
      );
      return;
    }

    if (!account) {
      Alert.alert(
        "Withdrawal account required",
        "Add and verify a bank account before requesting a withdrawal.",
      );
      return;
    }

    if (!isAccountUsable(account)) {
      const cooldown = formatCooldown(
        account.securityCooldownUntil,
      );

      Alert.alert(
        "Account temporarily unavailable",
        cooldown
          ? `This account is protected by a security cooldown until ${cooldown}.`
          : "This withdrawal account is not currently available.",
      );
      return;
    }

    if (value > available) {
      Alert.alert(
        "Insufficient balance",
        "The withdrawal amount is greater than your available balance.",
      );
      return;
    }

    setSelectedAccountId(account.id);

    Alert.alert(
      "Confirm withdrawal",
      `Withdraw ₦${money(value)} to ${account.bankName} ${account.accountNumber}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Confirm",
          onPress: () =>
            withdrawalMutation.mutate(
              Crypto.randomUUID(),
            ),
        },
      ],
    );
  };

  if (!user?.id) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>
          Transporter session unavailable.
        </Text>
      </View>
    );
  }

  if (
    walletQuery.isLoading ||
    bookingsQuery.isLoading ||
    accountsQuery.isLoading
  ) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>
          Loading financial history...
        </Text>
      </View>
    );
  }

  if (walletQuery.isError || !walletQuery.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>
          Unable to load wallet.
        </Text>

        <Pressable
          onPress={() => {
            walletQuery.refetch();
            bookingsQuery.refetch();
            accountsQuery.refetch();
          }}
          style={styles.button}
        >
          <Text style={styles.buttonText}>
            Try Again
          </Text>
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

      <Text style={styles.eyebrow}>
        FINANCIALS
      </Text>

      <Text style={styles.title}>
        Earnings & History
      </Text>

      <Text style={styles.subtitle}>
        Track released earnings, pending payments,
        completed trips and withdrawals.
      </Text>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>
          AVAILABLE EARNINGS
        </Text>

        <Text style={styles.balance}>
          ₦{money(wallet.availableBalance)}
        </Text>

        <Text style={styles.currency}>
          NGN
        </Text>
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
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderMain}>
            <Text style={styles.section}>
              WITHDRAWAL ACCOUNTS
            </Text>

            <Text style={styles.sectionDescription}>
              Only verified accounts can receive withdrawals.
            </Text>
          </View>

          <Text style={styles.securityBadge}>
            SECURE
          </Text>
        </View>

        {accounts.length === 0 ? (
          <View style={styles.accountEmpty}>
            <Text style={styles.accountEmptyTitle}>
              No withdrawal account
            </Text>

            <Text style={styles.accountEmptyText}>
              Add a Nigerian bank account and verify it
              with your secure phone verification code.
            </Text>
          </View>
        ) : (
          accounts.map((account) => {
            const cooldown = formatCooldown(
              account.securityCooldownUntil,
            );

            const selected =
              (selectedAccountId ||
                defaultAccount?.id) === account.id;

            return (
              <Pressable
                key={account.id}
                onPress={() => {
                  if (account.status !== "VERIFIED") {
                    return;
                  }

                  setSelectedAccountId(account.id);
                }}
                style={[
                  styles.accountRow,
                  selected &&
                    styles.accountRowSelected,
                ]}
              >
                <View style={styles.accountRadio}>
                  <View
                    style={[
                      styles.accountRadioDot,
                      selected &&
                        styles.accountRadioDotSelected,
                    ]}
                  />
                </View>

                <View style={styles.accountMain}>
                  <View style={styles.accountTitleRow}>
                    <Text style={styles.accountBank}>
                      {account.bankName ||
                        `Bank ${account.bankCode}`}
                    </Text>

                    {account.isDefault && (
                      <Text style={styles.defaultBadge}>
                        DEFAULT
                      </Text>
                    )}
                  </View>

                  <Text style={styles.accountNumber}>
                    {account.accountNumber}
                  </Text>

                  <Text style={styles.accountName}>
                    {account.accountName}
                  </Text>

                  {account.status === "VERIFIED" &&
                  cooldown ? (
                    <Text style={styles.cooldownText}>
                      🔒 Withdrawals locked until{" "}
                      {cooldown}
                    </Text>
                  ) : (
                    <Text
                      style={
                        account.status === "VERIFIED"
                          ? styles.verifiedText
                          : styles.accountStatus
                      }
                    >
                      {account.status === "VERIFIED"
                        ? "✓ Verified"
                        : account.status}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })
        )}

        <View style={styles.accountActions}>
          <Pressable
            disabled={challengeMutation.isPending}
            onPress={() =>
              startAccountSecurity(
                "ADD_WITHDRAWAL_ACCOUNT",
              )
            }
            style={[
              styles.secondaryButton,
              challengeMutation.isPending &&
                styles.disabled,
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              + Add account
            </Text>
          </Pressable>

          {defaultAccount && (
            <Pressable
              disabled={challengeMutation.isPending}
              onPress={() =>
                startAccountSecurity(
                  "CHANGE_WITHDRAWAL_ACCOUNT",
                )
              }
              style={[
                styles.secondaryButton,
                challengeMutation.isPending &&
                  styles.disabled,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                Change default
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {accountMode && (
        <View style={styles.card}>
          <View style={styles.securityHeader}>
            <View style={styles.securityIcon}>
              <Text>🔐</Text>
            </View>

            <View style={styles.securityHeaderText}>
              <Text style={styles.securityTitle}>
                {accountMode ===
                "CHANGE_WITHDRAWAL_ACCOUNT"
                  ? "Change withdrawal account"
                  : "Add withdrawal account"}
              </Text>

              <Text style={styles.securitySubtitle}>
                Verify your identity before changing
                withdrawal destinations.
              </Text>
            </View>
          </View>

          <View style={styles.securityNote}>
            <Text style={styles.securityNoteTitle}>
              Protected financial information
            </Text>

            <Text style={styles.securityNoteText}>
              A one-time security code is required.
              Your full bank account number is encrypted
              and never returned to the mobile app.
            </Text>
          </View>

          {!challengeId ? (
            <View style={styles.challengeWaiting}>
              <ActivityIndicator />
              <Text style={styles.muted}>
                Sending security code...
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.label}>
                Security code
              </Text>

              <TextInput
                value={otp}
                onChangeText={(text) =>
                  setOtp(
                    text
                      .replace(/\D/g, "")
                      .slice(0, 6),
                  )
                }
                placeholder="6-digit code"
                placeholderTextColor="#98A2B3"
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
                style={styles.input}
              />

              <Text style={styles.label}>
                Bank code
              </Text>

              <TextInput
                value={bankCode}
                onChangeText={(text) =>
                  setBankCode(
                    text
                      .replace(/\D/g, "")
                      .slice(0, 3),
                  )
                }
                placeholder="3-digit bank code"
                placeholderTextColor="#98A2B3"
                keyboardType="number-pad"
                maxLength={3}
                style={styles.input}
              />

              <Text style={styles.helper}>
                Enter the official 3-digit Nigerian bank
                code.
              </Text>

              <Text style={styles.label}>
                Account number
              </Text>

              <TextInput
                value={accountNumber}
                onChangeText={(text) =>
                  setAccountNumber(
                    text
                      .replace(/\D/g, "")
                      .slice(0, 10),
                  )
                }
                placeholder="10-digit account number"
                placeholderTextColor="#98A2B3"
                keyboardType="number-pad"
                maxLength={10}
                secureTextEntry
                style={styles.input}
              />

              <Text style={styles.helper}>
                The bank account name will be verified
                automatically. You cannot manually enter it.
              </Text>

              <Pressable
                disabled={accountMutation.isPending}
                onPress={submitAccount}
                style={[
                  styles.button,
                  accountMutation.isPending &&
                    styles.disabled,
                ]}
              >
                {accountMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>
                    Verify & Save Account
                  </Text>
                )}
              </Pressable>

              <Pressable
                disabled={accountMutation.isPending}
                onPress={() => {
                  setAccountMode(null);
                  setChallengeId("");
                  setOtp("");
                  setBankCode("");
                  setAccountNumber("");
                }}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>
                  Cancel
                </Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.section}>
          EARNINGS TRANSACTIONS
        </Text>

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
        <Text style={styles.section}>
          COMPLETED TRIPS
        </Text>

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
                <Text
                  style={styles.tripRoute}
                  numberOfLines={2}
                >
                  {booking.pickupLocation} →{" "}
                  {booking.destination}
                </Text>

                <Text style={styles.tripMeta}>
                  Completed{" "}
                  {formatDate(
                    booking.completedAt ??
                      booking.updatedAt,
                  )}
                </Text>
              </View>

              <View style={styles.tripAmount}>
                <Text style={styles.tripFare}>
                  ₦
                  {money(
                    booking.fare ??
                      booking.estimatedFare ??
                      "0",
                  )}
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
        <Text style={styles.section}>
          PAYMENT HISTORY
        </Text>

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
        <Text style={styles.section}>
          WITHDRAWAL HISTORY
        </Text>

        {withdrawals.length === 0 ? (
          <Empty text="No withdrawals requested yet." />
        ) : (
          withdrawals.map((withdrawal) => (
            <View
              key={withdrawal.id}
              style={styles.withdrawalRow}
            >
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
                  {withdrawal.bankName}
                </Text>

                <Text style={styles.tripMeta}>
                  {formatDate(withdrawal.createdAt)}
                </Text>
              </View>

              <Text style={styles.status}>
                {withdrawal.status}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>
          REQUEST WITHDRAWAL
        </Text>

        <View style={styles.securityNote}>
          <Text style={styles.securityNoteTitle}>
            🔒 Protected financial operation
          </Text>

          <Text style={styles.securityNoteText}>
            Withdrawals use verified withdrawal accounts,
            server-side balance validation, ownership
            checks, idempotency protection and concurrent
            transaction locking.
          </Text>
        </View>

        <Text style={styles.label}>
          Amount
        </Text>

        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="Enter amount"
          placeholderTextColor="#98A2B3"
          keyboardType="decimal-pad"
          style={styles.input}
        />

        <Text style={styles.label}>
          Withdrawal account
        </Text>

        {!defaultAccount ? (
          <View style={styles.noAccountBox}>
            <Text style={styles.noAccountTitle}>
              No verified account available
            </Text>

            <Text style={styles.noAccountText}>
              Add a withdrawal account above before
              requesting a withdrawal.
            </Text>
          </View>
        ) : (
          <View style={styles.selectedAccountBox}>
            <Text style={styles.selectedAccountLabel}>
              SELECTED DESTINATION
            </Text>

            <Text style={styles.selectedAccountBank}>
              {selectedAccount?.bankName}
            </Text>

            <Text style={styles.selectedAccountNumber}>
              {selectedAccount?.accountNumber}
            </Text>

            <Text style={styles.selectedAccountName}>
              {selectedAccount?.accountName}
            </Text>

            {selectedAccount &&
              formatCooldown(
                selectedAccount.securityCooldownUntil,
              ) && (
                <Text style={styles.cooldownText}>
                  🔒 Temporarily locked until{" "}
                  {formatCooldown(
                    selectedAccount.securityCooldownUntil,
                  )}
                </Text>
              )}
          </View>
        )}

        {accounts.length > 1 && (
          <View style={styles.accountSelector}>
            {accounts.map((account) => (
              <Pressable
                key={account.id}
                onPress={() =>
                  setSelectedAccountId(account.id)
                }
                style={[
                  styles.selectorOption,
                  selectedAccount?.id === account.id &&
                    styles.selectorOptionSelected,
                ]}
              >
                <Text
                  style={
                    selectedAccount?.id === account.id
                      ? styles.selectorTextSelected
                      : styles.selectorText
                  }
                >
                  {account.bankName}{" "}
                  {account.accountNumber}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable
          disabled={
            withdrawalMutation.isPending ||
            !selectedAccount ||
            !isAccountUsable(selectedAccount)
          }
          onPress={submitWithdrawal}
          style={[
            styles.button,
            (!selectedAccount ||
              !isAccountUsable(selectedAccount)) &&
              styles.disabled,
            withdrawalMutation.isPending &&
              styles.disabled,
          ]}
        >
          {withdrawalMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              Request Withdrawal
            </Text>
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
      <Text style={styles.summaryLabel}>
        {label}
      </Text>

      <Text style={styles.summaryValue}>
        {value}
      </Text>
    </View>
  );
}

function TransactionRow({
  transaction,
}: {
  transaction: WalletTransaction;
}) {
  const released =
    transaction.transactionType ===
    "SETTLEMENT_RELEASED";

  return (
    <View style={styles.transactionRow}>
      <View style={styles.transactionMain}>
        <Text style={styles.transactionTitle}>
          {transactionLabel(
            transaction.transactionType,
          )}
        </Text>

        <Text
          style={styles.transactionDescription}
          numberOfLines={2}
        >
          {transaction.description ??
            "Financial transaction"}
        </Text>

        <Text style={styles.tripMeta}>
          {formatDate(transaction.createdAt)}
          {transaction.bookingId
            ? ` • Booking ${transaction.bookingId.slice(
                0,
                8,
              )}`
            : ""}
        </Text>
      </View>

      <View style={styles.transactionAmount}>
        <Text
          style={[
            styles.amount,
            released
              ? styles.positive
              : styles.neutral,
          ]}
        >
          {released ? "+" : ""}
          ₦{money(transaction.amount)}
        </Text>

        <Text style={styles.status}>
          {transactionStatus(
            transaction.transactionType,
          )}
        </Text>
      </View>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Text style={styles.empty}>
      {text}
    </Text>
  );
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

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },

  sectionHeaderMain: {
    flex: 1,
  },

  section: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: "#667085",
  },

  sectionDescription: {
    marginTop: 5,
    color: "#667085",
    fontSize: 12,
    lineHeight: 17,
  },

  securityBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#ECFDF3",
    color: "#067647",
    fontSize: 9,
    fontWeight: "900",
  },

  accountEmpty: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
  },

  accountEmptyTitle: {
    color: "#101828",
    fontWeight: "800",
    fontSize: 14,
  },

  accountEmptyText: {
    marginTop: 5,
    color: "#667085",
    fontSize: 12,
    lineHeight: 18,
  },

  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 14,
    marginBottom: 10,
  },

  accountRowSelected: {
    borderColor: "#0B63CE",
    backgroundColor: "#F5F9FF",
  },

  accountRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#98A2B3",
    alignItems: "center",
    justifyContent: "center",
  },

  accountRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  accountRadioDotSelected: {
    backgroundColor: "#0B63CE",
  },

  accountMain: {
    flex: 1,
  },

  accountTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  accountBank: {
    flex: 1,
    color: "#101828",
    fontSize: 14,
    fontWeight: "900",
  },

  defaultBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "#EEF4FF",
    color: "#175CD3",
    fontSize: 8,
    fontWeight: "900",
  },

  accountNumber: {
    marginTop: 4,
    color: "#344054",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.4,
  },

  accountName: {
    marginTop: 3,
    color: "#667085",
    fontSize: 12,
  },

  verifiedText: {
    marginTop: 6,
    color: "#067647",
    fontSize: 10,
    fontWeight: "800",
  },

  accountStatus: {
    marginTop: 6,
    color: "#B42318",
    fontSize: 10,
    fontWeight: "800",
  },

  cooldownText: {
    marginTop: 6,
    color: "#B54708",
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 15,
  },

  accountActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },

  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#0B63CE",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  secondaryButtonText: {
    color: "#0B63CE",
    fontWeight: "800",
    fontSize: 13,
  },

  securityHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 14,
  },

  securityIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#EEF4FF",
    alignItems: "center",
    justifyContent: "center",
  },

  securityHeaderText: {
    flex: 1,
  },

  securityTitle: {
    color: "#101828",
    fontSize: 16,
    fontWeight: "900",
  },

  securitySubtitle: {
    marginTop: 3,
    color: "#667085",
    fontSize: 12,
    lineHeight: 17,
  },

  securityNote: {
    marginBottom: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F2F4F7",
  },

  securityNoteTitle: {
    color: "#344054",
    fontSize: 12,
    fontWeight: "900",
  },

  securityNoteText: {
    marginTop: 4,
    color: "#667085",
    fontSize: 11,
    lineHeight: 17,
  },

  challengeWaiting: {
    alignItems: "center",
    paddingVertical: 20,
  },

  label: {
    color: "#344054",
    fontWeight: "700",
    marginBottom: 7,
    marginTop: 4,
  },

  helper: {
    marginTop: -2,
    marginBottom: 12,
    color: "#667085",
    fontSize: 11,
    lineHeight: 16,
  },

  input: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: "#101828",
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },

  selectedAccountBox: {
    padding: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#F8FAFC",
    marginBottom: 10,
  },

  selectedAccountLabel: {
    color: "#667085",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  selectedAccountBank: {
    marginTop: 6,
    color: "#101828",
    fontSize: 15,
    fontWeight: "900",
  },

  selectedAccountNumber: {
    marginTop: 3,
    color: "#344054",
    fontSize: 14,
    fontWeight: "800",
  },

  selectedAccountName: {
    marginTop: 3,
    color: "#667085",
    fontSize: 12,
  },

  noAccountBox: {
    padding: 14,
    borderRadius: 13,
    backgroundColor: "#FFF7ED",
    marginBottom: 10,
  },

  noAccountTitle: {
    color: "#9A3412",
    fontSize: 13,
    fontWeight: "900",
  },

  noAccountText: {
    marginTop: 4,
    color: "#9A3412",
    fontSize: 11,
    lineHeight: 16,
  },

  accountSelector: {
    gap: 8,
    marginBottom: 8,
  },

  selectorOption: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E4E7EC",
  },

  selectorOptionSelected: {
    borderColor: "#0B63CE",
    backgroundColor: "#F5F9FF",
  },

  selectorText: {
    color: "#475467",
    fontSize: 12,
    fontWeight: "700",
  },

  selectorTextSelected: {
    color: "#0B63CE",
    fontSize: 12,
    fontWeight: "800",
  },

  cancelButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },

  cancelButtonText: {
    color: "#667085",
    fontWeight: "800",
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
