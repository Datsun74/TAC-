import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase";

type VerificationRequest = {
  email?: unknown;
  token?: unknown;
};

function invalidRequest() {
  return NextResponse.json({ error: "invalid_request", ok: false }, { status: 400 });
}

export async function POST(request: NextRequest) {
  let credentials: VerificationRequest;

  try {
    credentials = (await request.json()) as VerificationRequest;
  } catch {
    return invalidRequest();
  }

  const email = typeof credentials.email === "string" ? credentials.email.trim().toLowerCase() : "";
  const token = typeof credentials.token === "string" ? credentials.token.replace(/\s/g, "") : "";

  if (!/^\S+@\S+\.\S+$/.test(email) || !/^\d{6,8}$/.test(token)) {
    return invalidRequest();
  }

  const response = NextResponse.json({ ok: true });
  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicConfig();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, options, value }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });

  if (error) {
    return NextResponse.json(
      { error: error.code === "otp_expired" ? "otp_expired" : "verification_failed", ok: false },
      { status: 401 },
    );
  }

  return response;
}
