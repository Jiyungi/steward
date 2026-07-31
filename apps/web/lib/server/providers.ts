import "server-only";

import {
  A1MobileProvider,
  FetchA1MobileTransport,
  LiveKitServerSipTransport,
  LiveKitTelephonyProvider,
  ProviderActionAuditor,
  StripePaymentProvider,
  StripeSdkTransport,
  StripeWebhookVerifier,
} from "@steward/providers";

import { getServerConfig } from "./config";
import { getIncidentStore } from "./database";

let cachedProviders:
  | {
      a1: A1MobileProvider;
      telephony: LiveKitTelephonyProvider;
      payments: StripePaymentProvider;
      stripeWebhooks: StripeWebhookVerifier;
    }
  | undefined;

export function getProviders() {
  if (cachedProviders !== undefined) return cachedProviders;
  const config = getServerConfig();
  const store = getIncidentStore();
  const auditor = new ProviderActionAuditor(store);
  const a1Transport = new FetchA1MobileTransport({
    baseUrl: config.A1MOBILE_BASE_URL,
    teamKey: config.A1MOBILE_TEAM_KEY,
  });
  const stripeTransport = new StripeSdkTransport({ secretKey: config.STRIPE_SECRET_KEY });
  cachedProviders = {
    a1: new A1MobileProvider(a1Transport, auditor),
    telephony: new LiveKitTelephonyProvider(
      { outboundTrunkId: config.LIVEKIT_SIP_OUTBOUND_TRUNK_ID },
      new LiveKitServerSipTransport({
        livekitUrl: config.LIVEKIT_URL,
        apiKey: config.LIVEKIT_API_KEY,
        apiSecret: config.LIVEKIT_API_SECRET,
      }),
      auditor,
    ),
    payments: new StripePaymentProvider(stripeTransport, store, auditor),
    stripeWebhooks: new StripeWebhookVerifier(stripeTransport, store, auditor, config.STRIPE_WEBHOOK_SECRET),
  };
  return cachedProviders;
}
