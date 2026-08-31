import { SAML, type SamlConfig } from "@node-saml/node-saml";

// SAML 2.0 Service Provider config, read from env. The IdP can be any
// SAML 2.0-compliant provider (Okta, Azure AD, Google Workspace, etc.) —
// download its metadata XML and copy the SSO URL / entity id / cert here.
//
// Required to enable SSO:
//   SAML_IDP_SSO_URL     IdP's SSO redirect endpoint
//   SAML_IDP_ENTITY_ID   IdP's entity id (issuer)
//   SAML_IDP_CERT        IdP's public signing certificate (base64, no PEM headers)
//
// Optional:
//   SAML_SP_ENTITY_ID    defaults to `${base url}/api/auth/saml/metadata`
//   SAML_SP_PRIVATE_KEY  PEM private key — enables signed AuthnRequests
//   SAML_SP_CERT         PEM cert paired with the private key

function env(key: string): string {
  return (process.env[key] ?? "").trim();
}

function baseUrl(): string {
  return (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function isSamlConfigured(): boolean {
  return Boolean(env("SAML_IDP_SSO_URL") && env("SAML_IDP_ENTITY_ID") && env("SAML_IDP_CERT"));
}

/** Returns a configured SAML SP instance, or null if SSO isn't set up. */
export function getSamlProvider(): SAML | null {
  if (!isSamlConfigured()) return null;

  const base = baseUrl();
  const spPrivateKey = env("SAML_SP_PRIVATE_KEY");
  const spCert = env("SAML_SP_CERT");

  const config: SamlConfig = {
    issuer: env("SAML_SP_ENTITY_ID") || `${base}/api/auth/saml/metadata`,
    callbackUrl: `${base}/api/auth/saml/acs`,
    entryPoint: env("SAML_IDP_SSO_URL"),
    idpIssuer: env("SAML_IDP_ENTITY_ID"),
    idpCert: env("SAML_IDP_CERT"),
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: false,
    signatureAlgorithm: "sha256",
    digestAlgorithm: "sha256",
    identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    ...(spPrivateKey ? { privateKey: spPrivateKey } : {}),
    ...(spCert ? { publicCert: spCert } : {}),
  };

  return new SAML(config);
}

export interface SamlLoginResult {
  email: string;
  name: string;
  nameId: string;
  idpEntityId: string;
}

function firstAttr(profile: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = profile[key];
    if (Array.isArray(value) && value.length > 0) return String(value[0]);
    if (typeof value === "string" && value) return value;
  }
  return "";
}

/** Extracts the fields we care about from a validated SAML profile. */
export function extractSamlLogin(profile: Record<string, unknown>): SamlLoginResult {
  const nameId = typeof profile.nameID === "string" ? profile.nameID : "";
  const email =
    firstAttr(
      profile,
      "email",
      "mail",
      "emailAddress",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
      "urn:oid:0.9.2342.19200300.100.1.3",
    ) || nameId;
  const name =
    firstAttr(
      profile,
      "displayName",
      "name",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
      "urn:oid:2.16.840.1.113730.3.1.241",
    ) || email.split("@")[0];

  return { email, name, nameId, idpEntityId: env("SAML_IDP_ENTITY_ID") };
}
