import { auth } from "@/lib/auth";

// Protect everything except auth routes, the login page, public legal pages,
// the health probe, and the Plaid webhook receiver (which has its own JWT
// signature verification). Unauthenticated requests get redirected to /login.
export default auth((req) => {
  if (!req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: [
    "/((?!api/auth|api/plaid/webhook|api/health|login|welcome|privacy|terms|security|changelog|_next/static|_next/image|favicon.ico|monitoring).*)",
  ],
};
