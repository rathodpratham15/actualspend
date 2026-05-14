// Minimal shape of the Splitwise REST API responses we care about.
// Splitwise returns numbers as strings (e.g. "12.50"), so keep them as strings.

export type SplitwiseUser = {
  id: number;
  first_name: string;
  last_name: string | null;
  email: string;
};

export type SplitwiseExpenseUser = {
  user_id: number;
  paid_share: string;
  owed_share: string;
  net_balance: string;
};

export type SplitwiseExpense = {
  id: number;
  description: string | null;
  cost: string;
  currency_code: string;
  date: string; // ISO timestamp
  group_id: number | null;
  users: SplitwiseExpenseUser[];
  updated_at: string;
  deleted_at: string | null;
  // True when this row is a settlement payment between users (someone
  // marked "X paid Y $Z to settle up"), not a real shared expense.
  // Reimbursement matching keys off this.
  payment: boolean;
};

export type SplitwiseFriend = {
  id: number;
  first_name: string;
  last_name: string | null;
  email: string | null;
  picture?: { medium?: string; large?: string; small?: string };
  // Splitwise returns one entry per currency; we sum the USD ones for v1.
  balance?: Array<{ currency_code: string; amount: string }>;
};

export type GetCurrentUserResponse = { user: SplitwiseUser };
export type GetExpensesResponse = { expenses: SplitwiseExpense[] };
export type GetFriendsResponse = { friends: SplitwiseFriend[] };
