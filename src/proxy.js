import { NextResponse } from "next/server";

export default function proxy(request) {
  // Public paths that bypass authentication
  const publicPaths = ["/login", "/api/auth", "/api/session/complete", "/api/session/upload-audio", "/api/session/audio-chunk", "/api/session/transcript", "/api/session/slide", "/_next", "/favicon.ico"];
  const isPublicPath = publicPaths.some((path) => request.nextUrl.pathname.startsWith(path));

  if (isPublicPath) {
    return NextResponse.next();
  }

  // Check the auth cookie
  const authToken = request.cookies.get("auth_token")?.value;
  const validToken = process.env.APP_PASSWORD;

  // Protect all other routes if the token is missing or doesn't match the password
  if (!authToken || authToken !== validToken) {
    const loginUrl = new URL("/login", request.url);
    // Optionally preserve the current URL they tried to access
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Apply to all routes except api/auth and static files
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
