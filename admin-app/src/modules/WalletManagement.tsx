import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import {
  adjustAdminWallet,
  getAdminWallet,
  getAdminWalletFunding,
  getAdminWalletFundings,
  getAdminWallets,
  getAdminWalletTransactions,
  getAdminWalletWithdrawals,
  type AdminWallet,
  type AdminWalletFunding,
  type AdminWalletFundingDetail,
  type AdminWalletTransaction,
  type AdminWalletWithdrawal,
} from "../api/financial-operations";

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}

function formatAmount(
  value?: string | number | null,
  currency?: string | null,
) {
  if (value === null || value === undefined) return "—";

  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);

  const currencyLabel =
    currency?.toUpperCase() === "NGN"
      ? "₦"
      : currency
        ? `${currency} `
        : "";

  return `${currencyLabel}${amount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusClass(status: string) {
  return `status-${status.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function getRequestError(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    const serverError =
      typeof err.response?.data?.error === "string"
        ? err.response.data.error
        : undefined;

    const requestId =
      typeof err.response?.data?.requestId === "string"
        ? err.response.data.requestId
        : err.response?.headers?.["x-request-id"];

    if (serverError) {
      return `${serverError}${requestId ? ` (Request ID: ${requestId})` : ""}`;
    }

    return err.message || fallback;
  }

  return err instanceof Error ? err.message : fallback;
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="customer-empty">
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

export default function WalletManagement() {
  const [wallets, setWallets] = useState<AdminWallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<AdminWallet | null>(null);
  const [walletTransactions, setWalletTransactions] = useState<
    AdminWalletTransaction[]
  >([]);
  const [walletFundings, setWalletFundings] = useState<AdminWalletFunding[]>([]);
  const [walletWithdrawals, setWalletWithdrawals] = useState<
    AdminWalletWithdrawal[]
  >([]);
  const [selectedFunding, setSelectedFunding] =
    useState<AdminWalletFundingDetail | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletSearch, setWalletSearch] = useState("");
  const [walletRole, setWalletRole] = useState<
    "" | "CUSTOMER" | "TRANSPORTER"
  >("");
  const [walletError, setWalletError] = useState("");

  const loadWallets = useCallback(async () => {
    try {
      setWalletLoading(true);
      setWalletError("");

      const data = await getAdminWallets({
        search: walletSearch.trim() || undefined,
        role: walletRole || undefined,
      });

      setWallets(data?.wallets ?? []);
    } catch (err) {
      setWalletError(getRequestError(err, "Unable to load wallets."));
    } finally {
      setWalletLoading(false);
    }
  }, [walletRole, walletSearch]);

  const loadWalletDetail = useCallback(async (walletId: string) => {
    try {
      setWalletLoading(true);
      setWalletError("");

      const [wallet, transactions, fundings, withdrawals] = await Promise.all([
        getAdminWallet(walletId),
        getAdminWalletTransactions(walletId),
        getAdminWalletFundings(walletId),
        getAdminWalletWithdrawals(walletId),
      ]);

      setSelectedWallet(wallet);
      setWalletTransactions(transactions?.transactions ?? []);
      setWalletFundings(fundings?.fundings ?? []);
      setWalletWithdrawals(withdrawals?.withdrawals ?? []);
      setSelectedFunding(null);
    } catch (err) {
      setWalletError(getRequestError(err, "Unable to load wallet details."));
    } finally {
      setWalletLoading(false);
    }
  }, []);

  const loadFundingDetail = async (fundingId: string) => {
    try {
      setWalletError("");
      setSelectedFunding(await getAdminWalletFunding(fundingId));
    } catch (err) {
      setWalletError(getRequestError(err, "Unable to load funding details."));
    }
  };

  useEffect(() => {
    if (!selectedWallet) {
      void loadWallets();
    }
  }, [selectedWallet, loadWallets]);

  const runWalletAction = async (
    action: () => Promise<unknown>,
  ) => {
    try {
      setWalletError("");
      await action();

      if (selectedWallet) {
        await loadWalletDetail(selectedWallet.id);
      } else {
        await loadWallets();
      }
    } catch (err) {
      setWalletError(getRequestError(err, "Wallet operation failed."));
    }
  };

  return (
    <section className="dashboard">
      <div className="module-header">
        <div>
          <div className="module-kicker">
            ADMINISTRATION / WALLET MANAGEMENT
          </div>
          <h2>Wallet Management</h2>
          <p>
            Manage wallet balances, ledger activity, funding, withdrawals and
            audited wallet adjustments independently from Payments.
          </p>
        </div>

        <div>
          <span className="live-badge">CONNECTED</span>
        </div>
      </div>

      <WalletsPanel
        wallets={wallets}
        selectedWallet={selectedWallet}
        transactions={walletTransactions}
        fundings={walletFundings}
        withdrawals={walletWithdrawals}
        selectedFunding={selectedFunding}
        loading={walletLoading}
        error={walletError}
        search={walletSearch}
        role={walletRole}
        onSearchChange={setWalletSearch}
        onRoleChange={setWalletRole}
        onSearch={() => void loadWallets()}
        onSelect={(wallet) => void loadWalletDetail(wallet.id)}
        onBack={() => {
          setSelectedWallet(null);
          setSelectedFunding(null);
          setWalletError("");
        }}
        onFundingSelect={(id) => void loadFundingDetail(id)}
        onAdjust={(input) =>
          runWalletAction(() =>
            adjustAdminWallet(selectedWallet!.id, input),
          )
        }
      />
    </section>
  );
}

function WalletsPanel({
  wallets,
  selectedWallet,
  transactions,
  fundings,
  withdrawals,
  selectedFunding,
  loading,
  error,
  search,
  role,
  onSearchChange,
  onRoleChange,
  onSearch,
  onSelect,
  onBack,
  onFundingSelect,
  onAdjust,
}: {
  wallets: AdminWallet[];
  selectedWallet: AdminWallet | null;
  transactions: AdminWalletTransaction[];
  fundings: AdminWalletFunding[];
  withdrawals: AdminWalletWithdrawal[];
  selectedFunding: AdminWalletFundingDetail | null;
  loading: boolean;
  error: string;
  search: string;
  role: "" | "CUSTOMER" | "TRANSPORTER";
  onSearchChange: (value: string) => void;
  onRoleChange: (value: "" | "CUSTOMER" | "TRANSPORTER") => void;
  onSearch: () => void;
  onSelect: (wallet: AdminWallet) => void;
  onBack: () => void;
  onFundingSelect: (id: string) => void;
  onAdjust: (input: {
    direction: "CREDIT" | "DEBIT";
    amount: number;
    reason: string;
    reference: string;
  }) => Promise<void>;
}) {
  const [direction, setDirection] =
    useState<"CREDIT" | "DEBIT">("CREDIT");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const submitAdjustment = async () => {
    const numericAmount = Number(amount);

    if (
      !selectedWallet ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      reason.trim().length < 3 ||
      reference.trim().length < 3
    ) {
      return;
    }

    const owner =
      `${selectedWallet.user.firstName} ${selectedWallet.user.lastName}`;

    if (
      !window.confirm(
        `${direction === "CREDIT" ? "Credit" : "Debit"} ` +
        `₦${numericAmount.toLocaleString()} ${owner}'s wallet?`,
      )
    ) {
      return;
    }

    try {
      setAdjusting(true);

      await onAdjust({
        direction,
        amount: numericAmount,
        reason: reason.trim(),
        reference: reference.trim(),
      });

      setAmount("");
      setReason("");
      setReference("");
    } finally {
      setAdjusting(false);
    }
  };

  if (!selectedWallet) {
    return (
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Wallet Directory</h2>
            <p>
              Inspect customer and transporter wallets without directly
              editing balances.
            </p>
          </div>
          <span className="live-badge">
            {wallets.length} WALLETS
          </span>
        </div>

        <div className="wallet-toolbar">
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSearch();
            }}
            placeholder="Search name, email, phone or ID"
            aria-label="Search wallets"
          />

          <select
            value={role}
            onChange={(event) =>
              onRoleChange(
                event.target.value as
                  | ""
                  | "CUSTOMER"
                  | "TRANSPORTER",
              )
            }
            aria-label="Filter wallet role"
          >
            <option value="">All roles</option>
            <option value="CUSTOMER">Customer</option>
            <option value="TRANSPORTER">Transporter</option>
          </select>

          <button
            type="button"
            className="primary-action"
            onClick={onSearch}
            disabled={loading}
          >
            {loading ? "Loading…" : "Search"}
          </button>
        </div>

        {error && (
          <div className="error-state" role="alert">
            {error}
          </div>
        )}

        {!wallets.length && !loading ? (
          <EmptyState
            title="No wallets found."
            description="Try another search or role filter."
          />
        ) : (
          <div className="table-wrap wallet-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Owner</th>
                  <th>Role</th>
                  <th>Available</th>
                  <th>Pending</th>
                  <th>Activity</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {wallets.map((wallet) => (
                  <tr key={wallet.id}>
                    <td>
                      <strong>
                        {wallet.user.firstName} {wallet.user.lastName}
                      </strong>
                      <small>
                        {wallet.user.email ||
                          wallet.user.phone ||
                          wallet.user.id}
                      </small>
                    </td>

                    <td>
                      <span
                        className={`status-pill ${statusClass(
                          wallet.user.role,
                        )}`}
                      >
                        {wallet.user.role}
                      </span>
                    </td>

                    <td>
                      <strong>
                        {formatAmount(
                          wallet.availableBalance,
                          "NGN",
                        )}
                      </strong>
                    </td>

                    <td>
                      {formatAmount(
                        wallet.pendingBalance,
                        "NGN",
                      )}
                    </td>

                    <td>
                      {wallet.transactionCount} txns ·{" "}
                      {wallet.fundingCount} fundings ·{" "}
                      {wallet.withdrawalCount} withdrawals
                    </td>

                    <td>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => onSelect(wallet)}
                      >
                        Open wallet
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="wallet-workspace">
      <div className="panel">
        <div className="panel-header">
          <div>
            <button
              type="button"
              className="text-button"
              onClick={onBack}
            >
              ← Wallet directory
            </button>

            <h2>
              {selectedWallet.user.firstName}{" "}
              {selectedWallet.user.lastName}
            </h2>

            <p>
              {selectedWallet.user.email ||
                selectedWallet.user.phone ||
                selectedWallet.user.id}{" "}
              · {selectedWallet.user.role}
            </p>
          </div>

          <span className="live-badge">WALLET CONTROL</span>
        </div>

        {error && (
          <div className="error-state" role="alert">
            {error}
          </div>
        )}

        <div className="stats-grid wallet-detail-stats">
          <Stat
            label="Available"
            value={formatAmount(
              selectedWallet.availableBalance,
              "NGN",
            )}
            detail="Spendable wallet balance"
          />

          <Stat
            label="Pending"
            value={formatAmount(
              selectedWallet.pendingBalance,
              "NGN",
            )}
            detail="Pending wallet balance"
          />

          <Stat
            label="Transactions"
            value={selectedWallet.transactionCount}
            detail="Ledger records"
          />

          <Stat
            label="Fundings"
            value={selectedWallet.fundingCount}
            detail="Funding records"
          />
        </div>
      </div>

      <div className="wallet-detail-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Ledger</h2>
              <p>
                Immutable transaction history and administrator
                references.
              </p>
            </div>
          </div>

          {!transactions.length ? (
            <EmptyState
              title="No wallet transactions."
              description="This wallet has no ledger records yet."
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Description</th>
                    <th>Reference</th>
                  </tr>
                </thead>

                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{formatDate(transaction.createdAt)}</td>
                      <td>{transaction.transactionType}</td>
                      <td>
                        <strong>
                          {formatAmount(
                            transaction.amount,
                            "NGN",
                          )}
                        </strong>
                      </td>
                      <td>{transaction.description || "—"}</td>
                      <td>{transaction.reference || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Funding History</h2>
              <p>
                Provider references and webhook processing status.
              </p>
            </div>
          </div>

          {!fundings.length ? (
            <EmptyState
              title="No funding records."
              description="No wallet funding attempts were returned."
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Provider</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Reference</th>
                  </tr>
                </thead>

                <tbody>
                  {fundings.map((funding) => (
                    <tr key={funding.id}>
                      <td>{formatDate(funding.createdAt)}</td>
                      <td>{funding.provider}</td>
                      <td>
                        {formatAmount(
                          funding.amount,
                          funding.currency,
                        )}
                      </td>
                      <td>
                        <span
                          className={`status-pill ${statusClass(
                            funding.status,
                          )}`}
                        >
                          {funding.status}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() =>
                            onFundingSelect(funding.id)
                          }
                        >
                          {funding.transactionReference}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Withdrawals</h2>
            <p>
              Wallet-scoped withdrawal records and processing status.
            </p>
          </div>
        </div>

        {!withdrawals.length ? (
          <EmptyState
            title="No withdrawal records."
            description="No wallet withdrawal attempts were returned."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Bank</th>
                  <th>Account</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((withdrawal) => (
                  <tr key={withdrawal.id}>
                    <td>{formatDate(withdrawal.createdAt)}</td>
                    <td>
                      <strong>
                        {formatAmount(withdrawal.amount, "NGN")}
                      </strong>
                    </td>
                    <td>{withdrawal.bankName}</td>
                    <td>
                      {withdrawal.accountName} · {withdrawal.accountNumber}
                    </td>
                    <td>
                      <span
                        className={`status-pill ${statusClass(
                          withdrawal.status,
                        )}`}
                      >
                        {withdrawal.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedFunding && (
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Funding Trace</h2>
              <p>
                Webhook events are shown as processing metadata;
                payloads remain server-side.
              </p>
            </div>
          </div>

          <div className="wallet-trace">
            <div>
              <strong>Provider</strong>
              <span>{selectedFunding.provider}</span>
            </div>
            <div>
              <strong>Transaction</strong>
              <span>
                {selectedFunding.transactionReference}
              </span>
            </div>
            <div>
              <strong>Provider ID</strong>
              <span>
                {selectedFunding.providerTransactionId || "—"}
              </span>
            </div>
            <div>
              <strong>Status</strong>
              <span>{selectedFunding.status}</span>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Provider Event ID</th>
                  <th>Processed</th>
                  <th>Created</th>
                </tr>
              </thead>

              <tbody>
                {selectedFunding.webhookEvents.map((event) => (
                  <tr key={event.id}>
                    <td>{event.eventType}</td>
                    <td>{event.providerEventId}</td>
                    <td>{event.processed ? "Yes" : "No"}</td>
                    <td>{formatDate(event.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="panel wallet-adjustment-panel">
        <div className="panel-header">
          <div>
            <h2>Ledger Adjustment</h2>
            <p>
              Balances are changed only through an auditable ledger
              transaction. Every adjustment requires a unique reference
              and reason.
            </p>
          </div>
        </div>

        <div className="operations-message">
          <strong>Administrative control</strong>
          <span>
            Use adjustments only for an approved operational correction.
            The action records the administrator and previous/new balance
            values.
          </span>
        </div>

        <div className="wallet-adjustment-form">
          <select
            value={direction}
            onChange={(event) =>
              setDirection(
                event.target.value as "CREDIT" | "DEBIT",
              )
            }
          >
            <option value="CREDIT">Credit wallet</option>
            <option value="DEBIT">Debit wallet</option>
          </select>

          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="Amount (NGN)"
          />

          <input
            value={reference}
            onChange={(event) =>
              setReference(event.target.value)
            }
            placeholder="Unique reference"
          />

          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason for adjustment"
            rows={3}
          />

          <button
            type="button"
            className="primary-action"
            disabled={
              adjusting ||
              !amount ||
              reason.trim().length < 3 ||
              reference.trim().length < 3
            }
            onClick={() => void submitAdjustment()}
          >
            {adjusting
              ? "Applying…"
              : "Apply ledger adjustment"}
          </button>
        </div>
      </div>
    </div>
  );
}
