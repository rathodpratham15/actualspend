import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ScimValidationError extends Error {}
export class ScimConflictError extends Error {}

type UserRow = typeof users.$inferSelect;

export function toScimUser(row: UserRow) {
  const resource: Record<string, unknown> = {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id: row.id,
    userName: row.email,
    displayName: row.name ?? row.email,
    active: row.scimActive,
    meta: { resourceType: "User", location: `/api/scim/v2/Users/${row.id}` },
  };
  if (row.email) resource.emails = [{ value: row.email, type: "work", primary: true }];
  if (row.scimExternalId) resource.externalId = row.scimExternalId;
  return resource;
}

function primaryEmailFromPayload(payload: Record<string, unknown>): string {
  const emails = Array.isArray(payload.emails) ? (payload.emails as Record<string, unknown>[]) : [];
  let email = "";
  for (const e of emails) {
    if (e.primary || !email) email = String(e.value ?? "");
  }
  return email;
}

export async function scimListUsers(opts: {
  startIndex: number;
  count: number;
  filterAttr?: string;
  filterVal?: string;
}): Promise<{ resources: unknown[]; total: number }> {
  const { startIndex, count, filterAttr, filterVal } = opts;

  let rows: UserRow[];
  if (filterAttr === "userName" && filterVal) {
    rows = await db.select().from(users).where(eq(users.email, filterVal));
  } else if ((filterAttr === "emails.value" || filterAttr === "email") && filterVal) {
    rows = await db.select().from(users).where(eq(users.email, filterVal));
  } else if (filterAttr === "externalId" && filterVal) {
    rows = await db.select().from(users).where(eq(users.scimExternalId, filterVal));
  } else {
    rows = await db.select().from(users);
  }

  const total = rows.length;
  const page = rows.slice(startIndex - 1, startIndex - 1 + count);
  return { resources: page.map(toScimUser), total };
}

export async function scimGetUser(id: string) {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ? toScimUser(row) : null;
}

/** Creates a user from a SCIM User resource. userName must be an email — the
 * schema has no separate username column, and Okta/Entra SCIM apps for this
 * kind of integration conventionally map userName to email anyway. */
export async function scimProvisionUser(payload: Record<string, unknown>) {
  const userName = String(payload.userName ?? "").trim();
  if (!userName) throw new ScimValidationError("userName is required");
  if (!EMAIL_RE.test(userName)) throw new ScimValidationError("userName must be an email address");

  const email = primaryEmailFromPayload(payload) || userName;
  const displayName = typeof payload.displayName === "string" ? payload.displayName : userName;
  const externalId = typeof payload.externalId === "string" ? payload.externalId : null;
  const active = payload.active !== false;

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) throw new ScimConflictError(`userName already taken: ${email}`);

  const [created] = await db
    .insert(users)
    .values({
      email,
      name: displayName,
      emailVerified: new Date(),
      scimExternalId: externalId,
      scimActive: active,
    })
    .returning();
  return toScimUser(created);
}

export async function scimReplaceUser(id: string, payload: Record<string, unknown>) {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!row) return null;

  const email = primaryEmailFromPayload(payload) || row.email;
  const displayName = typeof payload.displayName === "string" ? payload.displayName : row.name;
  const externalId = typeof payload.externalId === "string" ? payload.externalId : row.scimExternalId;
  const active = payload.active !== false;

  const [updated] = await db
    .update(users)
    .set({ email, name: displayName, scimExternalId: externalId, scimActive: active })
    .where(eq(users.id, id))
    .returning();
  return toScimUser(updated);
}

interface PatchOp {
  op?: string;
  path?: string;
  value?: unknown;
}

export async function scimPatchUser(id: string, operations: PatchOp[]) {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!row) return null;

  const updates: Partial<UserRow> = {};
  for (const op of operations) {
    const opType = (op.op ?? "").toLowerCase();
    const path = (op.path ?? "").toLowerCase();
    const value = op.value;

    if (opType === "replace" || opType === "add") {
      if (path === "active") {
        updates.scimActive = Boolean(value);
      } else if (path === "username" || path === "emails" || path === "emails[type eq \"work\"].value") {
        if (typeof value === "string") updates.email = value;
      } else if (path === "externalid") {
        if (typeof value === "string") updates.scimExternalId = value;
      } else if (path === "displayname") {
        if (typeof value === "string") updates.name = value;
      } else if (path === "" && value && typeof value === "object") {
        const obj = value as Record<string, unknown>;
        if ("active" in obj) updates.scimActive = Boolean(obj.active);
        if (typeof obj.userName === "string") updates.email = obj.userName;
        if (typeof obj.displayName === "string") updates.name = obj.displayName;
        if (typeof obj.externalId === "string") updates.scimExternalId = obj.externalId;
        const email = primaryEmailFromPayload(obj);
        if (email) updates.email = email;
      }
    } else if (opType === "remove" && path === "active") {
      updates.scimActive = true; // RFC: removing "active" resets to the attribute default
    }
  }

  if (Object.keys(updates).length > 0) {
    await db.update(users).set(updates).where(eq(users.id, id));
  }
  return scimGetUser(id);
}

/** SCIM DELETE — soft-deactivates instead of deleting the row. A hard delete
 * would cascade-remove all of the user's transactions/Plaid items/etc. via
 * onDelete: cascade, which is not what an IdP admin offboarding an employee
 * intends. Deactivating blocks login immediately without destroying data. */
export async function scimDeactivateUser(id: string): Promise<boolean> {
  const [updated] = await db
    .update(users)
    .set({ scimActive: false })
    .where(eq(users.id, id))
    .returning({ id: users.id });
  return Boolean(updated);
}
