import type { VisionRequest } from "@steward/contracts";

export function canStartCamera(
  request: VisionRequest | null,
  decision: "accepted" | "declined" | null,
  nowMs: number = Date.now(),
): boolean {
  return request !== null
    && request.status === "pending"
    && decision === "accepted"
    && Date.parse(request.expiresAt) > nowMs;
}
