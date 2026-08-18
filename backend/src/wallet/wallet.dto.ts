type DecimalLike = {
  toFixed: (digits: number) => string;
};

function money(value: DecimalLike | number | string): string {
  if (
    typeof value === "object" &&
    value !== null &&
    typeof value.toFixed === "function"
  ) {
    return value.toFixed(2);
  }

  return Number(value).toFixed(2);
}

function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) {
    return "****";
  }

  return `******${accountNumber.slice(-4)}`;
}

export function toWalletTransactionDto(transaction: {
  id: string;
  walletId: string;
  bookingId: string | null;
  amount: DecimalLike | number | string;
  transactionType: string;
  description: string | null;
  createdAt: Date;
}) {
  return {
    id: transaction.id,
    walletId: transaction.walletId,
    bookingId: transaction.bookingId,
    amount: money(transaction.amount),
    transactionType: transaction.transactionType,
    description: transaction.description,
    createdAt: transaction.createdAt.toISOString(),
  };
}

export function toWithdrawalDto(withdrawal: {
  id: string;
  walletId: string;
  amount: DecimalLike | number | string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  status: string;
  createdAt: Date;
}) {
  return {
    id: withdrawal.id,
    walletId: withdrawal.walletId,
    amount: money(withdrawal.amount),
    bankName: withdrawal.bankName,
    accountNumber: maskAccountNumber(withdrawal.accountNumber),
    accountName: withdrawal.accountName,
    status: withdrawal.status,
    createdAt: withdrawal.createdAt.toISOString(),
  };
}

export function toWalletDto(wallet: {
  id: string;
  transporterId: string;
  availableBalance: DecimalLike | number | string;
  pendingBalance: DecimalLike | number | string;
  createdAt: Date;
  updatedAt: Date;
  transactions?: Array<{
    id: string;
    walletId: string;
    bookingId: string | null;
    amount: DecimalLike | number | string;
    transactionType: string;
    description: string | null;
    createdAt: Date;
  }>;
  withdrawals?: Array<{
    id: string;
    walletId: string;
    amount: DecimalLike | number | string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    status: string;
    createdAt: Date;
  }>;
}) {
  return {
    id: wallet.id,
    transporterId: wallet.transporterId,
    availableBalance: money(wallet.availableBalance),
    pendingBalance: money(wallet.pendingBalance),
    createdAt: wallet.createdAt.toISOString(),
    updatedAt: wallet.updatedAt.toISOString(),
    ...(wallet.transactions
      ? {
          transactions: wallet.transactions.map(toWalletTransactionDto),
        }
      : {}),
    ...(wallet.withdrawals
      ? {
          withdrawals: wallet.withdrawals.map(toWithdrawalDto),
        }
      : {}),
  };
}
