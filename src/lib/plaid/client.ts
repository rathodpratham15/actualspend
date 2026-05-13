import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const env = (process.env.PLAID_ENV ?? "sandbox") as keyof typeof PlaidEnvironments;

if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
  // Allow build-time imports without crashing; runtime checks happen in routes.
  console.warn("[plaid] PLAID_CLIENT_ID / PLAID_SECRET not set");
}

export const plaid = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID ?? "",
        "PLAID-SECRET": process.env.PLAID_SECRET ?? "",
      },
    },
  }),
);
