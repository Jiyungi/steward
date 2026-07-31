import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerConfig } from "../../../../lib/server/config";
import { apiError, parseJson, PublicRequestError } from "../../../../lib/server/http";
import { createSupabaseAuthClient } from "../../../../lib/server/supabase-auth";

const requestSchema = z.object({ email: z.email().max(320) }).strict();

export async function POST(request: Request) {
  try {
    const { email } = await parseJson(request, requestSchema);
    const config = getServerConfig();
    const supabase = await createSupabaseAuthClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${config.APP_BASE_URL.replace(/\/$/, "")}/auth/callback` },
    });
    if (error !== null) throw new PublicRequestError(502, "email_not_sent", "The sign-in email could not be sent.");
    return NextResponse.json({ status: "sent" });
  } catch (error) {
    return apiError(error);
  }
}
