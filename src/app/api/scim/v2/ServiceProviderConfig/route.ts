import { NextRequest, NextResponse } from "next/server";
import { checkScimAuth, scimUnauthorized, SERVICE_PROVIDER_CONFIG } from "@/lib/scim";

export async function GET(req: NextRequest) {
  if (!checkScimAuth(req)) return scimUnauthorized();
  return NextResponse.json(SERVICE_PROVIDER_CONFIG);
}
