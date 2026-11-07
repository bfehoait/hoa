export const financeReports = [
  {
    id: "collections",
    title: "Recorded collections",
    needs: "Imported receipt dates, amounts and physical lot links.",
    available: true,
  },
  {
    id: "balance-sheet",
    title: "Balance Sheet",
    needs:
      "Approved opening balances and a balanced ledger of assets, liabilities and association equity.",
    available: false,
  },
  {
    id: "income-expense",
    title: "Income and Expense Statement",
    needs:
      "Approved accounting basis, categorized income and expense entries, and period adjustments.",
    available: false,
  },
  {
    id: "budget-actual",
    title: "Budget vs. Actual Variance Report",
    needs:
      "An approved budget version and actual ledger entries mapped to the same categories and period.",
    available: false,
  },
  {
    id: "reserves",
    title: "Reserve Fund Report",
    needs:
      "Verified opening fund balances and classified contributions, transfers and spending.",
    available: false,
  },
  {
    id: "aging",
    title: "Accounts Receivable Aging",
    needs:
      "Approved invoices, due dates, opening receivables, credits and verified payment allocations.",
    available: false,
  },
  {
    id: "delinquency",
    title: "Delinquency Report",
    needs:
      "Verified receivables and approved grace-period, dispute and delinquency rules.",
    available: false,
  },
  {
    id: "bank",
    title: "Bank Reconciliation Report",
    needs:
      "Authorized bank statements, ledger cash entries and independently verified matches and adjustments.",
    available: false,
  },
] as const;
