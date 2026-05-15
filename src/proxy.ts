import { auth } from "@/lib/auth";

// Auth-gating proxy.
//
// Pass-through (no auth needed): /login, /welcome, /privacy, /terms,
// /security, /changelog, /api/auth/*, /api/plaid/webhook, /api/health,
// Sentry tunnel (/monitoring), and static assets.
//
// Behavior for unauthenticated requests that hit a protected route:
//   - hitting "/" → redirect to /welcome (marketing front door)
//   - hitting anything else → redirect to /login (they need to sign in)
//
// Authenticated requests: pass through.
export default auth((req) => {
  if (req.auth) return;
  const path = req.nextUrl.pathname;
  const target = path === "/" ? "/welcome" : "/login";
  return Response.redirect(new URL(target, req.nextUrl.origin));
});

export const config = {
  matcher: [
    "/((?!api/auth|api/plaid/webhook|api/health|login|welcome|privacy|terms|security|changelog|_next/static|_next/image|favicon.ico|monitoring).*)",
  ],
};
