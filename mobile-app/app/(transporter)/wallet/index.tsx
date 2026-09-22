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
import { router, usePathname } from "expo-router";
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
  const pathname = usePathname();

  const walletMode =
    pathname.endsWith("/wallet/earnings")
      ? "earnings"
      : pathname.endsWith("/wallet/completed")
        ? "completed"
        : pathname.endsWith("/wallet/withdrawals")
          ? "withdrawals"
          : "hub";

  const [selectedCompletedJobId, setSelectedCompletedJobId] =
    useState<string | null>(null);

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
        "A verification code has been sent to your verified phone number and email address.",
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

  const earningsTransactions = useMemo(
    () =>
      transactions.filter(
        (item) =>
          item.transactionType === "SETTLEMENT_RELEASED",
      ),
    [transactions],
  );

  const pendingPayments = useMemo(() => {
    const releasedBookingIds = new Set(
      transactions
        .filter(
          (item) =>
            item.transactionType === "SETTLEMENT_RELEASED" &&
            item.bookingId,
        )
        .map((item) => item.bookingId),
    );

    return transactions.filter(
      (item) =>
        item.transactionType === "PAYMENT_PENDING" &&
        (!item.bookingId ||
          !releasedBookingIds.has(item.bookingId)),
    );
  }, [transactions]);

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
        {walletMode === "hub" ? "Wallet" : walletMode === "earnings" ? "Wallet & Earnings" : walletMode === "completed" ? "Completed Jobs & Payments" : "Withdrawals"}
      </Text>

      {walletMode === "hub" && (
            <View style={styles.walletHubCard}>
              <Text style={styles.walletHubTitle}>WALLET</Text>
              <Text style={styles.walletHubSubtitle}>
                Choose what you want to manage.
              </Text>

              <Pressable
                style={styles.walletNavigationCard}
                onPress={() =>
                  router.push("/(transporter)/wallet/earnings" as never)
                }
              >
                <View style={styles.walletNavigationMain}>
                  <Text style={styles.walletNavigationTitle}>
                    Wallet & Earnings
                  </Text>
                  <Text style={styles.walletNavigationText}>
                    Balance and released earnings transactions
                  </Text>
                </View>
                <Text style={styles.walletNavigationArrow}>›</Text>
              </Pressable>

              <Pressable
                style={styles.walletNavigationCard}
                onPress={() =>
                  router.push("/(transporter)/wallet/completed" as never)
                }
              >
                <View style={styles.walletNavigationMain}>
                  <Text style={styles.walletNavigationTitle}>
                    Completed Jobs & Payments
                  </Text>
                  <Text style={styles.walletNavigationText}>
                    Completed jobs and pending payments
                  </Text>
                </View>
                <Text style={styles.walletNavigationArrow}>›</Text>
              </Pressable>

              <Pressable
                style={styles.walletNavigationCard}
                onPress={() =>
                  router.push("/(transporter)/wallet/withdrawals" as never)
                }
              >
                <View style={styles.walletNavigationMain}>
                  <Text style={styles.walletNavigationTitle}>
                    Withdrawals
                  </Text>
                  <Text style={styles.walletNavigationText}>
                    Withdrawal accounts, history and requests
                  </Text>
                </View>
                <Text style={styles.walletNavigationArrow}>›</Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.subtitle}>
        Track released earnings, pending payments,
        completed trips and withdrawals.
      </Text>

      <View style={[styles.balanceCard, walletMode !== "earnings" && styles.hiddenSection]}>
        <Text style={styles.balanceLabel}>
          AVAILABLE EARNINGS
        </Text>

        <Text
          style={[styles.balance, styles.greenAmount]}
          numberOfLines={1}
        >
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
          green
        />

        <SummaryCard
          label="Completed trips"
          value={String(completedTrips.length)}
        />
      </View>

      <View style={[styles.card, walletMode !== "withdrawals" && styles.hiddenSection]}>
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

      {walletMode === "withdrawals" && accountMode && (
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

      <View style={[styles.card, walletMode !== "earnings" && styles.hiddenSection]}>
        <Text style={styles.section}>
          EARNINGS TRANSACTIONS
        </Text>

        {earningsTransactions.length === 0 ? (
          <Empty text="No earnings transactions recorded yet." />
        ) : (
          earningsTransactions.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
            />
          ))
        )}
      </View>

      <View style={[styles.card, walletMode !== "completed" && styles.hiddenSection]}>
        <Text style={styles.section}>
          COMPLETED JOBS
        </Text>

        {completedTrips.length === 0 ? (
          <Empty text="No completed trips yet." />
        ) : (
          completedTrips.map((booking) => (
            <React.Fragment key={booking.id}>
            <Pressable
              key={booking.id}
              style={[
                styles.tripRow,
                selectedCompletedJobId === booking.id &&
                  styles.selectedTripRow,
              ]}
              onPress={() =>
                setSelectedCompletedJobId(
                  selectedCompletedJobId === booking.id
                    ? null
                    : booking.id,
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

            {selectedCompletedJobId === booking.id && (
              <View style={styles.completedJobDetailCard}>
                <Text style={styles.completedJobDetailTitle}>
                  COMPLETED JOB DETAILS
                </Text>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Shipment ID</Text>
                  <Text style={styles.detailValue}>{booking.id}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Route</Text>
                  <Text style={styles.detailValue}>
                    {booking.pickupLocation} → {booking.destination}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Cargo</Text>
                  <Text style={styles.detailValue}>
                    {booking.cargoDescription || "Not specified"}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Cargo category</Text>
                  <Text style={styles.detailValue}>
                    {booking.cargoCategory || "Not specified"}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Cargo weight</Text>
                  <Text style={styles.detailValue}>
                    {booking.cargoWeight || "Not specified"}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Truck category</Text>
                  <Text style={styles.detailValue}>
                    {booking.truckCategory}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Fare</Text>
                  <Text style={styles.detailValue}>
                    ₦
                    {money(
                      booking.fare ??
                        booking.estimatedFare ??
                        "0",
                    )}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Payment status</Text>
                  <Text style={styles.detailValue}>
                    {booking.paymentStatus}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Payment method</Text>
                  <Text style={styles.detailValue}>
                    {booking.paymentMethod}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Scheduled</Text>
                  <Text style={styles.detailValue}>
                    {booking.scheduledDate
                      ? formatDate(booking.scheduledDate)
                      : "Not specified"}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Completed</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(
                      booking.completedAt ??
                        booking.updatedAt,
                    )}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>
                    Proof of delivery
                  </Text>
                  <Text style={styles.detailValue}>
                    {booking.proofOfDelivery
                      ? "Available"
                      : "Not available"}
                  </Text>
                </View>
              </View>
            )}
            </React.Fragment>
          ))
        )}
      </View>

      <View style={[styles.card, walletMode !== "completed" && styles.hiddenSection]}>
        <Text style={styles.section}>
          PENDING PAYMENTS
        </Text>

        {pendingPayments.length === 0 ? (
          <Empty text="No pending payments." />
        ) : (
          pendingPayments.map((transaction) => (
            <TransactionRow
              key={`payment-${transaction.id}`}
              transaction={transaction}
            />
          ))
        )}
      </View>

      <View style={[styles.card, walletMode !== "withdrawals" && styles.hiddenSection]}>
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

      <View style={[styles.card, walletMode !== "withdrawals" && styles.hiddenSection]}>
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

        <View style={styles.currencyInput}>
          <Text style={styles.currencyPrefix}>₦</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="Enter amount"
            placeholderTextColor="#98A2B3"
            keyboardType="decimal-pad"
            style={styles.currencyInputField}
          />
        </View>

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
  green = false,
}: {
  label: string;
  value: string;
  green?: boolean;
}) {
  return (
    <View style={styles.summaryCard}>
      <Text style={[styles.summaryLabel, green && styles.greenText]}>
        {label}
      </Text>

      <Text
        style={[styles.summaryValue, green && styles.greenText]}
        numberOfLines={1}
      >
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
  hiddenSection: {
    display: "none",
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 50,
    backgroundColor: "#F4F7FF",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    backgroundColor: "#F4F7FF",
  },

  back: {
    alignSelf: "flex-start",
    color: "#4169E1",
    backgroundColor: "#EAF0FF",
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 20,
    overflow: "hidden",
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.7,
    color: "#4169E1",
  },

  title: {
    marginTop: 5,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    color: "#101B3A",
  },

  subtitle: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
  },

  walletHubCard: {
    marginBottom: 18,
    padding: 17,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7F5",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },

  walletHubTitle: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
    color: "#4169E1",
    marginBottom: 5,
  },

  walletHubSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: "#667085",
    marginBottom: 13,
  },

  walletNavigationCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
    minHeight: 76,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E1E7F5",
    backgroundColor: "#F9FAFF",
    marginBottom: 10,
  },

  walletNavigationMain: {
    flex: 1,
    paddingRight: 12,
  },

  walletNavigationTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#101B3A",
    marginBottom: 4,
  },

  walletNavigationText: {
    fontSize: 11,
    lineHeight: 17,
    color: "#667085",
  },

  walletNavigationArrow: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "400",
    color: "#4169E1",
  },

  balanceCard: {
    padding: 23,
    borderRadius: 22,
    backgroundColor: "#101B3A",
    marginBottom: 16,
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.17,
    shadowRadius: 15,
    elevation: 5,
  },

  balanceLabel: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#AEB9D5",
  },

  balance: {
    marginTop: 10,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    color: "#FFFFFF",
    flexShrink: 0,
  },

  greenText: {
    color: "#32D583",
  },

  greenAmount: {
    color: "#32D583",
  },

  currency: {
    marginTop: 5,
    color: "#AEB9D5",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  summaryGrid: {
    flexDirection: "row",
    gap: 9,
    marginBottom: 16,
  },

  summaryCard: {
    flex: 1,
    minHeight: 78,
    padding: 13,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7F5",
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 7,
    elevation: 2,
  },

  summaryLabel: {
    fontSize: 9,
    lineHeight: 13,
    color: "#667085",
    fontWeight: "800",
  },

  summaryValue: {
    marginTop: 7,
    fontSize: 14,
    lineHeight: 19,
    color: "#101B3A",
    fontWeight: "900",
    flexShrink: 0,
  },

  card: {
    padding: 19,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7F5",
    marginBottom: 16,
    shadowColor: "#101B3A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
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
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: "#4169E1",
  },

  sectionDescription: {
    marginTop: 5,
    color: "#667085",
    fontSize: 11,
    lineHeight: 17,
  },

  securityBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#ECFDF3",
    color: "#027A48",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  accountEmpty: {
    padding: 15,
    borderRadius: 14,
    backgroundColor: "#F4F7FF",
    borderWidth: 1,
    borderColor: "#E1E7F5",
  },

  accountEmptyTitle: {
    color: "#101B3A",
    fontWeight: "900",
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
    padding: 14,
    borderWidth: 1,
    borderColor: "#E1E7F5",
    borderRadius: 15,
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
  },

  accountRowSelected: {
    borderColor: "#4169E1",
    backgroundColor: "#F4F7FF",
  },

  accountRadio: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#98A2B3",
    alignItems: "center",
    justifyContent: "center",
  },

  accountRadioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },

  accountRadioDotSelected: {
    backgroundColor: "#4169E1",
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
    color: "#101B3A",
    fontSize: 14,
    fontWeight: "900",
  },

  defaultBadge: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#EAF0FF",
    color: "#4169E1",
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
    color: "#027A48",
    fontSize: 10,
    fontWeight: "900",
  },

  accountStatus: {
    marginTop: 6,
    color: "#B42318",
    fontSize: 10,
    fontWeight: "900",
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
    marginTop: 5,
  },

  secondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#4169E1",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: "#F8FAFF",
  },

  secondaryButtonText: {
    color: "#4169E1",
    fontWeight: "900",
    fontSize: 12,
  },

  securityHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 14,
  },

  securityIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#EAF0FF",
    alignItems: "center",
    justifyContent: "center",
  },

  securityHeaderText: {
    flex: 1,
  },

  securityTitle: {
    color: "#101B3A",
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
    padding: 13,
    borderRadius: 13,
    backgroundColor: "#F4F7FF",
    borderWidth: 1,
    borderColor: "#DCE4F7",
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
    color: "#475467",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
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
    borderColor: "#D5DDF0",
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: "#101B3A",
    backgroundColor: "#F9FAFF",
    marginBottom: 12,
  },

  currencyInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D5DDF0",
    borderRadius: 13,
    backgroundColor: "#F9FAFF",
    marginBottom: 12,
  },

  currencyPrefix: {
    paddingLeft: 14,
    fontSize: 16,
    color: "#344054",
    fontWeight: "900",
  },

  currencyInputField: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 13,
    fontSize: 15,
    color: "#101B3A",
  },

  selectedAccountBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D5DDF0",
    backgroundColor: "#F8FAFF",
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
    color: "#101B3A",
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
    borderRadius: 14,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
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
    padding: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#E1E7F5",
    backgroundColor: "#FFFFFF",
  },

  selectorOptionSelected: {
    borderColor: "#4169E1",
    backgroundColor: "#F4F7FF",
  },

  selectorText: {
    color: "#475467",
    fontSize: 12,
    fontWeight: "700",
  },

  selectorTextSelected: {
    color: "#4169E1",
    fontSize: 12,
    fontWeight: "900",
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF1F7",
    gap: 12,
  },

  transactionMain: {
    flex: 1,
  },

  transactionTitle: {
    color: "#101B3A",
    fontSize: 14,
    fontWeight: "900",
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
    color: "#027A48",
  },

  neutral: {
    color: "#344054",
  },

  status: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: "900",
    color: "#667085",
  },

  tripRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF1F7",
    gap: 12,
  },

  tripMain: {
    flex: 1,
  },

  tripRoute: {
    color: "#101B3A",
    fontSize: 14,
    fontWeight: "900",
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
    color: "#101B3A",
    fontSize: 14,
    fontWeight: "900",
  },

  tripStatus: {
    marginTop: 4,
    color: "#027A48",
    fontSize: 9,
    fontWeight: "900",
  },

  withdrawalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF1F7",
  },

  withdrawalTitle: {
    color: "#101B3A",
    fontSize: 14,
    fontWeight: "900",
  },

  completedJobDetailCard: {
    marginTop: -4,
    marginBottom: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E1E7F5",
    borderRadius: 14,
    backgroundColor: "#F9FAFF",
  },

  completedJobDetailTitle: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    color: "#4169E1",
    marginBottom: 10,
  },

  selectedTripRow: {
    borderWidth: 2,
    borderColor: "#4169E1",
    backgroundColor: "#F4F7FF",
  },

  detailRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E9EDF5",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },

  detailLabel: {
    flex: 0.9,
    fontSize: 12,
    fontWeight: "800",
    color: "#475467",
  },

  detailValue: {
    flex: 1.4,
    fontSize: 12,
    textAlign: "right",
    color: "#344054",
  },

  button: {
    marginTop: 14,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#4169E1",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 7,
    elevation: 3,
  },

  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 0.5,
  },

  disabled: {
    opacity: 0.55,
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
    fontSize: 13,
  },

  error: {
    color: "#B42318",
    textAlign: "center",
    marginBottom: 15,
    fontSize: 14,
    lineHeight: 20,
  },
});
