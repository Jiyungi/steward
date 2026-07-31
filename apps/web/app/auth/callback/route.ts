import { NextResponse } from "next/server";

import { createSupabaseAuthClient } from "../../../lib/server/supabase-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirectTo = new URL("/voice", url.origin);
  if (code === null) {
    redirectTo.searchParams.set("auth", "missing-code");
    return NextResponse.redirect(redirectTo);
  }

  const supabase = await createSupabaseAuthClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error !== null) redirectTo.searchParams.set("auth", "failed");
  else redirectTo.searchParams.set("auth", "verified");
  return NextResponse.redirect(redirectTo);
}
