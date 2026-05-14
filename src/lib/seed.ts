// Realistic seeded data for ActualSpend — Oct 2025.
// This is design-time mock data used by the new UI branch; the production
// dashboard reads from the database via lib/dashboard/*.

export const monthLabel = "Oct 2025";
export const userEmail = "alex@actualspend.app";

export const totals = {
  actual: 2890.43,
  bankOutflow: 4217.5,
  sharedFronted: 1840.0,
  reimbursementsPending: 560.0,
  sharedAdjustments: 1327.07,
};

export const categories: { name: string; amount: number }[] = [
  { name: "Rent", amount: 950 },
  { name: "Other", amount: 531 },
  { name: "Groceries", amount: 482 },
  { name: "Eating out", amount: 244 },
  { name: "Social", amount: 203 },
  { name: "Utilities", amount: 121 },
  { name: "Entertainment", amount: 117 },
  { name: "Education", amount: 95 },
  { name: "Transport", amount: 89 },
  { name: "Subscriptions", amount: 58 },
];

export const reconCounts = {
  matched: 32,
  awaiting: 4,
  splitwiseOnly: 3,
  personal: 51,
};

export const banks = [
  {
    name: "Chase",
    accountCount: 2,
    lastSync: "2 hours ago",
    needsReauth: false,
  },
  {
    name: "Capital One",
    accountCount: 1,
    lastSync: "1 day ago",
    needsReauth: true,
  },
];

export const splitwiseStatus = {
  connected: true,
  syncedExpenses: 47,
  lastSync: "3 hours ago",
};

export type PlaidEnv = "Sandbox" | "Development" | "Production";
export const plaidEnv: PlaidEnv = "Sandbox";

export type ReconciliationPair = {
  id: string;
  bank: {
    date: string;
    merchant: string;
    account: string;
    amount: number;
  };
  splitwise: {
    title: string;
    group: string;
    total: number;
    yourShare: number;
    people: number;
  };
  confidence: number;
  reasons: string[];
};

export const awaitingReview: ReconciliationPair[] = [
  {
    id: "r1",
    bank: {
      date: "2025-10-12",
      merchant: "COSTCO WHOLESALE #412",
      account: "Chase Checking",
      amount: -240.0,
    },
    splitwise: {
      title: "Costco groceries",
      group: "Roommates — Cambridge",
      total: 240.0,
      yourShare: 80.0,
      people: 3,
    },
    confidence: 82,
    reasons: [
      "Amount matches exactly",
      "Dates 1 day apart",
      'Merchant "COSTCO" matches description',
    ],
  },
  {
    id: "r2",
    bank: {
      date: "2025-10-13",
      merchant: "AIRBNB * TAHOE STAY",
      account: "Chase Sapphire",
      amount: -680.0,
    },
    splitwise: {
      title: "Tahoe Airbnb",
      group: "Tahoe trip",
      total: 680.0,
      yourShare: 170.0,
      people: 4,
    },
    confidence: 91,
    reasons: [
      "Amount matches exactly",
      "Same day",
      'Merchant "AIRBNB" matches "Tahoe Airbnb"',
    ],
  },
  {
    id: "r3",
    bank: {
      date: "2025-10-14",
      merchant: "WHOLE FOODS MKT #2342",
      account: "Chase Checking",
      amount: -74.18,
    },
    splitwise: {
      title: "Sunday dinner groceries",
      group: "Roommates — Cambridge",
      total: 74.18,
      yourShare: 24.73,
      people: 3,
    },
    confidence: 76,
    reasons: ["Amount matches exactly", "Same day"],
  },
  {
    id: "r4",
    bank: {
      date: "2025-10-20",
      merchant: "CONED *UTILITY",
      account: "Chase Checking",
      amount: -148.5,
    },
    splitwise: {
      title: "October ConEd",
      group: "Roommates — Cambridge",
      total: 148.5,
      yourShare: 49.5,
      people: 3,
    },
    confidence: 68,
    reasons: ["Amount matches exactly", "Dates 2 days apart"],
  },
];

export const matchedAuto = [
  {
    id: "m1",
    bank: { date: "2025-10-04", merchant: "TRADER JOE'S #543", amount: -82.14 },
    splitwise: { title: "Weekly groceries", yourShare: 27.38 },
    confidence: 96,
  },
  {
    id: "m2",
    bank: { date: "2025-10-07", merchant: "UBER *TRIP", amount: -42.6 },
    splitwise: { title: "Cab to airport", yourShare: 14.2 },
    confidence: 94,
  },
  {
    id: "m3",
    bank: { date: "2025-10-15", merchant: "VENMO *J. PARK", amount: 80.0 },
    splitwise: { title: "Costco share — Jordan", yourShare: 0 },
    confidence: 99,
  },
];

export const splitwiseOnly = [
  {
    id: "s1",
    title: "Sunday dinner (cash)",
    group: "Roommates — Cambridge",
    total: 64.0,
    yourShare: 21.33,
  },
  {
    id: "s2",
    title: "Concert tickets",
    group: "Friends — Boston",
    total: 180.0,
    yourShare: 60.0,
  },
  {
    id: "s3",
    title: "Brunch at Tatte",
    group: "Friends — Boston",
    total: 92.4,
    yourShare: 30.8,
  },
];

export const personalUnmatched = [
  {
    id: "p1",
    date: "2025-10-02",
    merchant: "SPOTIFY USA",
    amount: -10.99,
    suggested: "Subscriptions",
  },
  {
    id: "p2",
    date: "2025-10-05",
    merchant: "MBTA *CHARLIE",
    amount: -30.0,
    suggested: "Transport",
  },
  {
    id: "p3",
    date: "2025-10-08",
    merchant: "CVS/PHARMACY #2841",
    amount: -18.42,
    suggested: "Other",
  },
  {
    id: "p4",
    date: "2025-10-11",
    merchant: "BLUE BOTTLE COFFEE",
    amount: -6.5,
    suggested: "Eating out",
  },
];

export const changelogEntries: { date: string; items: string[] }[] = [
  {
    date: "2026-04-18",
    items: [
      "Added reimbursement pending detection for unmatched Venmo deposits.",
      "Improved Splitwise transaction matching for partial repayments.",
    ],
  },
  {
    date: "2026-03-29",
    items: [
      "Dashboard category breakdown now excludes roommate reimbursements from dining totals.",
      "Date range picker gains a year-to-date preset.",
    ],
  },
  {
    date: "2026-03-04",
    items: [
      "Initial Plaid integration launched in beta.",
      "Splitwise OAuth flow live for invited users.",
    ],
  },
];

export const faqs: { q: string; a: string }[] = [
  {
    q: "Is my bank data safe?",
    a: "We use Plaid for bank connections, so your credentials never pass through our servers. We only receive read-only transaction access.",
  },
  {
    q: "What banks are supported?",
    a: "Anything Plaid supports in the US and Canada. UK support is in testing.",
  },
  {
    q: "Do I need Splitwise?",
    a: "No, but the product is substantially more useful with it. Without Splitwise, we can only infer reimbursements from transfers and Venmo deposits.",
  },
  {
    q: "What if my roommate doesn't use Splitwise?",
    a: "You can manually mark reimbursements or shared transactions. We treat those adjustments as reconciliation rules.",
  },
  {
    q: "What does it cost?",
    a: "Free during beta. Paid plans will likely be a flat monthly subscription.",
  },
  {
    q: "Can I export my data?",
    a: "Yes. CSV and JSON exports are available.",
  },
  {
    q: "Does it work internationally?",
    a: "Plaid support depends on region. US and Canada work now. UK support is in testing.",
  },
];
