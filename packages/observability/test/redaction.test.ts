import { afterEach, describe, expect, it } from "vitest";

import {
  maskLangfuseData,
  redactForTelemetry,
} from "../src/redaction.js";

const originalOpenAiKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  if (originalOpenAiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }
});

describe("redactForTelemetry", () => {
  it("removes secrets, PII, payment data, and raw media", () => {
    process.env.OPENAI_API_KEY = "a1hk_super_secret_value";

    const redacted = redactForTelemetry({
      apiKey: "a1hk_super_secret_value",
      callerPhone: "+14155550123",
      guestEmail: "guest@example.com",
      card: "4242 4242 4242 4242",
      imageData: "data:image/png;base64,AAAA",
      useful: "lock troubleshooting",
    });

    expect(redacted).toEqual({
      apiKey: "[SECRET_REDACTED]",
      callerPhone: "[PHONE_REDACTED]",
      guestEmail: "[EMAIL_REDACTED]",
      card: "[PAYMENT_DATA_REDACTED]",
      imageData: "[MEDIA_OMITTED]",
      useful: "lock troubleshooting",
    });
  });

  it("masks sensitive text embedded in serialized Langfuse attributes", () => {
    process.env.OPENAI_API_KEY = "a1hk_super_secret_value";

    const masked = maskLangfuseData({
      data: JSON.stringify({
        prompt: "Email guest@example.com or call +14155550123",
        token: "a1hk_super_secret_value",
      }),
    });

    expect(String(masked)).not.toContain("guest@example.com");
    expect(String(masked)).not.toContain("+14155550123");
    expect(String(masked)).not.toContain("a1hk_super_secret_value");
  });
});
