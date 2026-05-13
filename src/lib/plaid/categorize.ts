import type { PlaidCategory } from "@/lib/db/schema";

// Maps Plaid Personal Finance Category (PFC) primary buckets to our canonical
// category codes. Detailed-level overrides win for cases where the primary
// is too coarse (e.g. FOOD_AND_DRINK → groceries vs. eating out).
//
// Reference: https://plaid.com/docs/api/products/transactions/#categories-get
const PRIMARY_MAP: Record<string, string> = {
  INCOME: "INCOME",
  TRANSFER_IN: "TRANSFER",
  TRANSFER_OUT: "TRANSFER",
  LOAN_PAYMENTS: "OTHER",
  BANK_FEES: "OTHER",
  ENTERTAINMENT: "ENTERTAINMENT",
  FOOD_AND_DRINK: "EATING_OUT",
  GENERAL_MERCHANDISE: "OTHER",
  HOME_IMPROVEMENT: "OTHER",
  MEDICAL: "OTHER",
  PERSONAL_CARE: "OTHER",
  GENERAL_SERVICES: "OTHER",
  GOVERNMENT_AND_NON_PROFIT: "OTHER",
  TRANSPORTATION: "TRANSPORT",
  TRAVEL: "OTHER",
  RENT_AND_UTILITIES: "UTILITIES",
};

const DETAILED_MAP: Record<string, string> = {
  FOOD_AND_DRINK_GROCERIES: "GROCERIES",
  RENT_AND_UTILITIES_RENT: "RENT",
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: "UTILITIES",
  RENT_AND_UTILITIES_INTERNET_AND_CABLE: "UTILITIES",
  RENT_AND_UTILITIES_TELEPHONE: "UTILITIES",
  RENT_AND_UTILITIES_WATER: "UTILITIES",
  ENTERTAINMENT_TV_AND_MOVIES: "SUBSCRIPTION",
  ENTERTAINMENT_MUSIC_AND_AUDIO: "SUBSCRIPTION",
  GENERAL_SERVICES_EDUCATION: "EDUCATION",
};

export function toCanonical(pfc: PlaidCategory | null | undefined): string | null {
  if (!pfc) return null;
  return DETAILED_MAP[pfc.detailed] ?? PRIMARY_MAP[pfc.primary] ?? "OTHER";
}
