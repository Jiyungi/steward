import { createHash, randomUUID } from "node:crypto";

import { StripeSdkTransport } from "@steward/providers";
import { NextResponse } from "next/server";

import { getServerConfig } from "../../../../lib/server/config";
import { apiError, PublicRequestError } from "../../../../lib/server/http";
import { getProviders } from "../../../../lib/server/providers";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");
    if (signature === null) throw new PublicRequestError(400, "missing_signature", "Stripe signature is required.");
    const config = getServerConfig();
    const receipt = new StripeSdkTransport({ secretKey: config.STRIPE_SECRET_KEY })
      .constructWebhookEvent(rawBody, signature, config.STRIPE_WEBHOOK_SECRET);
    if (receipt.incidentId === null) throw new PublicRequestError(400, "incident_missing", "The Stripe event has no incident reference.");
    const digest = createHash("sha256").update(rawBody).digest("hex").slice(0, 32);
    const result = await getProviders().stripeWebhooks.verifyAndRecord({
      incidentId: receipt.incidentId,
      operationId: `op_${randomUUID()}`,
      idempotencyKey: `stripe-webhook:${receipt.id}:${digest}`,
      rawBody,
      signature,
    });
    return NextResponse.json({ received: result.status === "success", result }, { status: result.status === "success" ? 200 : 422 });
  } catch (error) {
    if (error instanceof PublicRequestError) return apiError(error);
    return NextResponse.json({ error: { code: "invalid_signature", message: "Stripe signature verification failed." } }, { status: 400 });
  }
}
