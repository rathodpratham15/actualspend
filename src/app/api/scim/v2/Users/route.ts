import { NextRequest, NextResponse } from "next/server";
import { checkScimAuth, scimUnauthorized, scimError, parseFilter, SCIM_SCHEMA_LIST } from "@/lib/scim";
import { scimListUsers, scimProvisionUser, ScimConflictError, ScimValidationError } from "@/lib/scim-users";

export async function GET(req: NextRequest) {
  if (!checkScimAuth(req)) return scimUnauthorized();

  const params = req.nextUrl.searchParams;
  const startIndex = Math.max(1, Number(params.get("startIndex")) || 1);
  const count = Math.min(200, Number(params.get("count")) || 100);
  const filter = parseFilter(params.get("filter") ?? "");

  const { resources, total } = await scimListUsers({
    startIndex,
    count,
    filterAttr: filter?.attr,
    filterVal: filter?.value,
  });

  return NextResponse.json({
    schemas: [SCIM_SCHEMA_LIST],
    totalResults: total,
    itemsPerPage: resources.length,
    startIndex,
    Resources: resources,
  });
}

export async function POST(req: NextRequest) {
  if (!checkScimAuth(req)) return scimUnauthorized();

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return scimError("Invalid JSON body", 400, "invalidSyntax");
  }

  try {
    const user = await scimProvisionUser(payload);
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    if (err instanceof ScimConflictError) return scimError(err.message, 409, "uniqueness");
    if (err instanceof ScimValidationError) return scimError(err.message, 400, "invalidValue");
    throw err;
  }
}
