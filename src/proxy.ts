import { auth } from "@/lib/auth";

// Auth-gating proxy.
//
// Pass-through (no auth needed): /login, /welcome, /privacy, /terms,
// /security, /api/auth/*, /api/plaid/webhook, /api/health,
// Sentry tunnel (/monitoring), public static files (*.svg, etc.), and
// Next asset routes.
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
    "/((?!api/auth|api/plaid/webhook|api/health|login|register|forgot-password|reset-password|welcome|privacy|terms|security|_next/static|_next/image|favicon.ico|monitoring|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
