import { NextRequest, NextResponse } from "next/server";
import { checkScimAuth, scimUnauthorized, RESOURCE_TYPES } from "@/lib/scim";

export async function GET(req: NextRequest) {
  if (!checkScimAuth(req)) return scimUnauthorized();
  return NextResponse.json(RESOURCE_TYPES);
}
