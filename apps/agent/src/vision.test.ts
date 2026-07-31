import { describe, expect, it } from "vitest";

import { parseVisionResponse } from "./vision.js";

describe("parseVisionResponse", () => {
  it("accepts the agreed client payload", () => {
    const payload = new TextEncoder().encode(
      JSON.stringify({
        requestId: "vision-1",
        status: "accepted",
        mediaRef: "livekit-track://camera",
      }),
    );
    expect(parseVisionResponse(payload)).toEqual({
      requestId: "vision-1",
      status: "accepted",
      mediaRef: "livekit-track://camera",
    });
  });

  it("rejects malformed and unsupported responses", () => {
    expect(() => parseVisionResponse(new TextEncoder().encode("{"))).toThrow(
      /valid JSON/,
    );
    expect(() =>
      parseVisionResponse(
        new TextEncoder().encode(
          JSON.stringify({ requestId: "vision-1", status: "granted" }),
        ),
      ),
    ).toThrow(/invalid status/);
  });
});
