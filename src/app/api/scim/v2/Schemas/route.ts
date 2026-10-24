import { NextRequest, NextResponse } from "next/server";
import { checkScimAuth, scimUnauthorized, SCHEMA_USER } from "@/lib/scim";

export async function GET(req: NextRequest) {
  if (!checkScimAuth(req)) return scimUnauthorized();
  return NextResponse.json(SCHEMA_USER);
}
