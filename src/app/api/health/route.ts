import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

// Health probe for Vercel / uptime monitoring. Returns 200 with a tiny DB
// roundtrip so we know the connection pool is alive too. No auth — intentional.
export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return Response.json({
      ok: true,
      ts: new Date().toISOString(),
      plaidEnv: process.env.PLAID_ENV ?? "sandbox",
    });
  } catch (err) {
    console.error("[health] db check failed", err);
    return new Response(
      JSON.stringify({ ok: false, error: "db_unreachable" }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
