import { describe, expect, it } from "vitest";

import {
  loadAgentRuntimeConfig,
  loadPublicWebConfig,
  loadWebServerConfig,
} from "../src/index.js";

const validEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  APP_BASE_URL: "http://localhost:3000",
  DEMO_GUEST_ACCESS_ENABLED: "true",
  DEMO_PROPERTY_SLUG: "steward-demo-home",
  GUEST_LINK_EXPIRY_DAYS: "14",
  MAX_PARALLEL_VENDOR_CALLS: "2",
  A1MOBILE_BASE_URL: "https://hack.a1mobile.com",
  A1MOBILE_TEAM_KEY: "team-secret",
  A1MOBILE_PHONE_NUMBER: "+15555550100",
  OPENAI_API_KEY: "model-secret",
  OPENAI_BASE_URL: "https://model.example.com/openai/v1",
  OPENAI_MODEL: "example-model",
  LIVEKIT_URL: "wss://example.livekit.cloud",
  LIVEKIT_API_KEY: "livekit-key",
  LIVEKIT_API_SECRET: "livekit-secret",
  LIVEKIT_AGENT_NAME: "steward",
  LIVEKIT_SIP_INBOUND_TRUNK_ID: "ST_inbound",
  LIVEKIT_SIP_OUTBOUND_TRUNK_ID: "ST_outbound",
  LIVEKIT_SIP_DISPATCH_RULE_ID: "SDR_dispatch",
  NEXT_PUBLIC_LIVEKIT_URL: "wss://example.livekit.cloud",
  DEEPGRAM_API_KEY: "deepgram-secret",
  DEEPGRAM_STT_MODEL: "flux-general-en",
  DEEPGRAM_TTS_MODEL: "aura-2-thalia-en",
  DEEPGRAM_TTS_SPEED: "1.0",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  SUPABASE_SECRET_KEY: "sb_secret_example",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_example",
  STRIPE_SECRET_KEY: "sk_test_example",
  STRIPE_WEBHOOK_SECRET: "whsec_example",
  LANGFUSE_PUBLIC_KEY: "pk-lf-example",
  LANGFUSE_SECRET_KEY: "sk-lf-example",
  LANGFUSE_BASE_URL: "https://us.cloud.langfuse.com",
  LANGFUSE_TRACING_ENVIRONMENT: "test",
};

describe("typed environment boundaries", () => {
  it("loads the complete agent configuration", () => {
    expect(loadAgentRuntimeConfig(validEnvironment).DEEPGRAM_STT_MODEL).toBe("flux-general-en");
  });

  it("returns only explicitly public values", () => {
    const publicConfig = loadPublicWebConfig(validEnvironment);
    expect(Object.keys(publicConfig).sort()).toEqual([
      "DEMO_GUEST_ACCESS_ENABLED",
      "DEMO_PROPERTY_SLUG",
      "NEXT_PUBLIC_LIVEKIT_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "NEXT_PUBLIC_SUPABASE_URL",
    ]);
    expect(JSON.stringify(publicConfig)).not.toContain("secret");
  });

  it("rejects server secrets with a public prefix", () => {
    expect(() =>
      loadWebServerConfig({
        ...validEnvironment,
        NEXT_PUBLIC_LIVEKIT_API_SECRET: "should-never-be-public",
      }),
    ).toThrow("NEXT_PUBLIC_LIVEKIT_API_SECRET");
  });

  it("reports missing field names without values", () => {
    const environment = { ...validEnvironment };
    delete environment.LIVEKIT_API_SECRET;
    expect(() => loadWebServerConfig(environment)).toThrow("LIVEKIT_API_SECRET");
  });
});
