import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerConfig } from "../../../../lib/server/config";
import { createDemoGuestSession } from "../../../../lib/server/demo";
import { apiError, parseJson, PublicRequestError } from "../../../../lib/server/http";

const requestSchema = z.object({ email: z.email().max(320) }).strict();

export async function POST(request: Request) {
  try {
    if (!getServerConfig().DEMO_GUEST_ACCESS_ENABLED) {
      throw new PublicRequestError(403, "demo_access_disabled", "Demo guest access is not enabled.");
    }
    const { email } = await parseJson(request, requestSchema);
    const session = await createDemoGuestSession(email);
    return NextResponse.json({ session });
  } catch (error) {
    return apiError(error);
  }
}
