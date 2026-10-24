import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

// SCIM 2.0 server utilities (RFC 7643 + RFC 7644). Endpoint handlers live in
// src/app/api/scim/v2/**; this module holds the shared constants/helpers.

export const SCIM_SCHEMA_USER = "urn:ietf:params:scim:schemas:core:2.0:User";
export const SCIM_SCHEMA_LIST = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
export const SCIM_SCHEMA_ERROR = "urn:ietf:params:scim:api:messages:2.0:Error";

/**
 * Bearer-token check for SCIM requests. Fails closed: if SCIM_BEARER_TOKEN
 * isn't set, SCIM is disabled rather than open. Uses a timing-safe compare
 * so response latency can't leak how much of the token matched.
 */
export function checkScimAuth(req: NextRequest): boolean {
  const expected = (process.env.SCIM_BEARER_TOKEN ?? "").trim();
  if (!expected) return false;

  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const provided = auth.slice(7).trim();

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

export function scimError(detail: string, status = 400, scimType?: string): NextResponse {
  return NextResponse.json(
    {
      schemas: [SCIM_SCHEMA_ERROR],
      detail,
      status: String(status),
      ...(scimType ? { scimType } : {}),
    },
    { status },
  );
}

export function scimUnauthorized(): NextResponse {
  return scimError("Unauthorized", 401);
}

export const SERVICE_PROVIDER_CONFIG = {
  schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
  documentationUri: "https://github.com/rathodpratham15/ActualSpend",
  patch: { supported: true },
  bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
  filter: { supported: true, maxResults: 200 },
  changePassword: { supported: false },
  sort: { supported: false },
  etag: { supported: false },
  authenticationSchemes: [
    {
      type: "oauthbearertoken",
      name: "OAuth Bearer Token",
      description: "Authentication scheme using the OAuth Bearer Token Standard",
      specUri: "http://www.rfc-editor.org/info/rfc6750",
      primary: true,
    },
  ],
  meta: { resourceType: "ServiceProviderConfig", location: "/api/scim/v2/ServiceProviderConfig" },
};

export const RESOURCE_TYPES = {
  schemas: [SCIM_SCHEMA_LIST],
  totalResults: 1,
  Resources: [
    {
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
      id: "User",
      name: "User",
      endpoint: "/api/scim/v2/Users",
      description: "User Account",
      schema: SCIM_SCHEMA_USER,
      schemaExtensions: [],
      meta: { location: "/api/scim/v2/ResourceTypes/User", resourceType: "ResourceType" },
    },
  ],
};

export const SCHEMA_USER = {
  schemas: [SCIM_SCHEMA_LIST],
  totalResults: 1,
  Resources: [
    {
      id: SCIM_SCHEMA_USER,
      name: "User",
      description: "User Account",
      attributes: [
        {
          name: "userName",
          type: "string",
          multiValued: false,
          required: true,
          caseExact: false,
          mutability: "readWrite",
          returned: "default",
          uniqueness: "server",
        },
        {
          name: "displayName",
          type: "string",
          multiValued: false,
          required: false,
          mutability: "readWrite",
          returned: "default",
        },
        {
          name: "emails",
          type: "complex",
          multiValued: true,
          required: false,
          mutability: "readWrite",
          returned: "default",
          subAttributes: [
            { name: "value", type: "string", multiValued: false },
            { name: "type", type: "string", multiValued: false },
            { name: "primary", type: "boolean", multiValued: false },
          ],
        },
        {
          name: "active",
          type: "boolean",
          multiValued: false,
          required: false,
          mutability: "readWrite",
          returned: "default",
        },
        {
          name: "externalId",
          type: "string",
          multiValued: false,
          required: false,
          mutability: "readWrite",
          returned: "default",
        },
      ],
      meta: { resourceType: "Schema", location: `/api/scim/v2/Schemas/${SCIM_SCHEMA_USER}` },
    },
  ],
};

/**
 * Parses the subset of SCIM filter syntax (RFC 7644 §3.4.2.2) that real-world
 * provisioners actually send: `attr eq "value"`. Returns null if it doesn't
 * match that shape — callers should ignore the filter rather than error.
 */
export function parseFilter(filterStr: string): { attr: string; value: string } | null {
  const match = /^(\S+)\s+eq\s+"([^"]*)"$/i.exec(filterStr.trim());
  if (!match) return null;
  return { attr: match[1], value: match[2] };
}
