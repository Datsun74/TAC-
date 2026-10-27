import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase";
import { isLocalTestMode } from "@/lib/test-mode";

const protectedRoutes = new Set(["/", "/purchases", "/add", "/shopping", "/purchased", "/rejected", "/family"]);

function copySessionCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));

  ["cache-control", "expires", "pragma"].forEach((headerName) => {
    const headerValue = source.headers.get(headerName);

    if (headerValue) {
      target.headers.set(headerName, headerValue);
    }
  });

  return target;
}

export async function updateSession(request: NextRequest) {
  if (isLocalTestMode()) {
    return NextResponse.next({ request });
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicConfig();
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: claimsData,
  } = await supabase.auth.getClaims();
  const isAuthenticated = typeof claimsData?.claims.sub === "string";
  const pathname = request.nextUrl.pathname;

  if (!isAuthenticated && (protectedRoutes.has(pathname) || pathname === "/access-pending")) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";

    return copySessionCookies(supabaseResponse, NextResponse.redirect(loginUrl));
  }

  return supabaseResponse;
}
