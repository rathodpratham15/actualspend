import { auth } from "@/lib/auth";

// Protect everything except auth routes, the login page, and static assets.
// Unauthenticated requests get redirected to /login by the matcher below.
export default auth((req) => {
  if (!req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: [
    // Run on all paths except: api/auth/*, _next, static files, the login page.
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
