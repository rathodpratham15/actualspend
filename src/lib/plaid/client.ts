import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

export type PlaidEnv = "sandbox" | "development" | "production";

export const plaidEnv = (process.env.PLAID_ENV ?? "sandbox") as PlaidEnv;

if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
  // Allow build-time imports without crashing; runtime checks happen in routes.
  console.warn("[plaid] PLAID_CLIENT_ID / PLAID_SECRET not set");
}

export const plaid = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[plaidEnv],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID ?? "",
        "PLAID-SECRET": process.env.PLAID_SECRET ?? "",
      },
    },
  }),
);
