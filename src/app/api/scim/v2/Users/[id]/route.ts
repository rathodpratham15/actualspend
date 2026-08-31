import { NextRequest, NextResponse } from "next/server";
import { checkScimAuth, scimUnauthorized, scimError } from "@/lib/scim";
import { scimGetUser, scimReplaceUser, scimPatchUser, scimDeactivateUser } from "@/lib/scim-users";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  if (!checkScimAuth(req)) return scimUnauthorized();
  const { id } = await params;
  const user = await scimGetUser(id);
  if (!user) return scimError("User not found", 404);
  return NextResponse.json(user);
}

export async function PUT(req: NextRequest, { params }: Params) {
  if (!checkScimAuth(req)) return scimUnauthorized();
  const { id } = await params;

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return scimError("Invalid JSON body", 400, "invalidSyntax");
  }

  const user = await scimReplaceUser(id, payload);
  if (!user) return scimError("User not found", 404);
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!checkScimAuth(req)) return scimUnauthorized();
  const { id } = await params;

  let body: { Operations?: unknown };
  try {
    body = await req.json();
  } catch {
    return scimError("Invalid JSON body", 400, "invalidSyntax");
  }

  const operations = Array.isArray(body.Operations) ? body.Operations : [];
  const user = await scimPatchUser(id, operations);
  if (!user) return scimError("User not found", 404);
  return NextResponse.json(user);
}

// Soft-deactivates rather than deleting the row — see scimDeactivateUser().
export async function DELETE(req: NextRequest, { params }: Params) {
  if (!checkScimAuth(req)) return scimUnauthorized();
  const { id } = await params;

  const ok = await scimDeactivateUser(id);
  if (!ok) return scimError("User not found", 404);
  return new NextResponse(null, { status: 204 });
}
