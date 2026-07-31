import { NextResponse } from "next/server";

import { getPublicWebConfig } from "../../../../lib/server/config";

export async function GET() {
  const config = getPublicWebConfig();
  return NextResponse.json({
    livekitUrl: config.NEXT_PUBLIC_LIVEKIT_URL,
    demoGuestAccessEnabled: config.DEMO_GUEST_ACCESS_ENABLED,
    propertySlug: config.DEMO_PROPERTY_SLUG,
  });
}
