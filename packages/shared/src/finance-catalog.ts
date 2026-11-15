export const financeReports = [
  {
    id: "collections",
    title: "Recorded collections",
    needs: "Past receipts with payment dates, amounts and matching properties.",
    available: true,
  },
  {
    id: "balance-sheet",
    title: "Balance Sheet",
    needs:
      "Approved starting balances and complete records of what the association owns, owes and holds in its funds.",
    available: false,
  },
  {
    id: "income-expense",
    title: "Income and Expense Statement",
    needs:
      "Approved accounting rules, income and expenses grouped by category, and corrections for the selected dates.",
    available: false,
  },
  {
    id: "budget-actual",
    title: "Budget compared with actual spending",
    needs:
      "An approved budget and recorded income and expenses for the same categories and dates.",
    available: false,
  },
  {
    id: "reserves",
    title: "Reserve Fund Report",
    needs:
      "Confirmed starting fund balances and records of contributions, transfers and spending.",
    available: false,
  },
  {
    id: "aging",
    title: "Unpaid bills by age",
    needs:
      "Approved bills, due dates, starting unpaid balances, credits and confirmed payments applied to those bills.",
    available: false,
  },
  {
    id: "delinquency",
    title: "Delinquency Report",
    needs:
      "Confirmed unpaid bills and approved rules for late payments, grace periods and disputes.",
    available: false,
  },
  {
    id: "bank",
    title: "Bank Reconciliation Report",
    needs:
      "Bank statements and cash records, with payments and corrections checked against each other by a separate reviewer.",
    available: false,
  },
] as const;
