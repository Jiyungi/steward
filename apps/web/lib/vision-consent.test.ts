import type { VisionRequest } from "@steward/contracts";
import { describe, expect, it } from "vitest";

import { canStartCamera } from "./vision-consent";

const request: VisionRequest = {
  version: 1,
  id: "vision-1",
  incidentId: "incident-1",
  question: "Show me the part that is not moving.",
  explanation: "A visual check could reduce guesswork.",
  requestedEvidence: "live-camera",
  status: "pending",
  createdAt: "2026-07-31T20:00:00.000Z",
  expiresAt: "2026-07-31T20:02:00.000Z",
};

describe("camera consent gate", () => {
  it("rejects missing, declined, and expired requests", () => {
    expect(canStartCamera(null, "accepted", Date.parse("2026-07-31T20:01:00.000Z"))).toBe(false);
    expect(canStartCamera(request, "declined", Date.parse("2026-07-31T20:01:00.000Z"))).toBe(false);
    expect(canStartCamera(request, "accepted", Date.parse(request.expiresAt))).toBe(false);
  });

  it("allows camera only for an accepted current request", () => {
    expect(canStartCamera(request, "accepted", Date.parse("2026-07-31T20:01:00.000Z"))).toBe(true);
  });
});
