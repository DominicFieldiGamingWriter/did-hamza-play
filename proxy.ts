import { get } from "@vercel/global-config";
import { NextResponse, type NextRequest } from "next/server";

const MAINTENANCE_CONFIG_KEY = "hamzaMaintenance";

function shouldBypassMaintenance(pathname: string) {
  return (
    pathname === "/maintenance" ||
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\\.[^/]+$/.test(pathname)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldBypassMaintenance(pathname)) {
    return NextResponse.next();
  }

  try {
    const enabled = await get(MAINTENANCE_CONFIG_KEY);

    if (enabled === true) {
      const destination = request.nextUrl.clone();
      destination.pathname = "/maintenance";
      destination.search = "";
      return NextResponse.rewrite(destination);
    }
  } catch (error) {
    // Fail open if Global Config is temporarily unavailable.
    console.error("[maintenance-mode] Could not read site status:", error);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"]
};
