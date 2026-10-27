import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const code = request.nextUrl.searchParams.get("code");
  const flowId = request.nextUrl.searchParams.get("sb_flow_id");
  const successUrl = request.nextUrl.clone();
  successUrl.pathname = "/";
  successUrl.search = "";

  // The Supabase client must write its session cookies to the exact redirect response.
  // Otherwise the next request reaches the home page without an authenticated session.
  const response = NextResponse.redirect(successUrl);
  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicConfig();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "email",
    });

    if (!error) return response;

    console.warn("Supabase email verification failed", {
      code: error.code,
      status: error.status,
    });
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);

    if (!error) return response;

    console.warn("Supabase magic-link exchange failed", {
      code: error.code,
      status: error.status,
    });
  }

  const failureUrl = request.nextUrl.clone();
  failureUrl.pathname = "/login";
  failureUrl.search = "?auth=failed";
  return NextResponse.redirect(failureUrl);
}
