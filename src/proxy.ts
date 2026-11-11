import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Runs before every matched request. Signed-out visitors are sent to /login.
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const user = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login") {
    // Already signed in: no need to see the login page again.
    return user ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  }
  if (user) return NextResponse.next();

  // Scripts and downloads get a plain 401; browsers get the login page.
  if (pathname.startsWith("/api/")) return new NextResponse("Unauthorized", { status: 401 });

  const url = new URL("/login", req.url);
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except: the jig endpoints (protected by the device key instead),
  // Next.js internals, and the icons/logo used by the login page.
  matcher: ["/((?!api/send|_next/|favicon.ico|icon.png|apple-icon.png|konwert.png).*)"],
};
