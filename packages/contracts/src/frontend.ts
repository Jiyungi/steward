import { z } from "zod";

import type { DemoGuestSession, GuestLinkClaim } from "./actors.js";
import type { IncidentEvent } from "./events.js";
import type { IncidentSnapshot } from "./incidents.js";
import type { VisionRequest } from "./vision.js";
import type { VoiceStatusEvent } from "./voice.js";

export const connectionStateSchema = z.enum([
  "connecting",
  "connected",
  "reconnecting",
  "disconnected",
  "failed",
]);

export type ConnectionState = z.infer<typeof connectionStateSchema>;

export type GuestSessionResolution =
  | { kind: "booking"; claim: GuestLinkClaim }
  | { kind: "demo"; session: DemoGuestSession };

export interface GuestSessionPort {
  resolve(input: { linkToken?: string; email?: string }): Promise<GuestSessionResolution>;
}

export interface IncidentSubscriptionHandlers {
  onSnapshot(snapshot: IncidentSnapshot): void;
  onEvent(event: IncidentEvent): void;
  onVoiceStatus(event: VoiceStatusEvent): void;
  onConnectionState(state: ConnectionState): void;
  onError(error: Error): void;
}

export type Unsubscribe = () => void;

export interface IncidentSubscriptionPort {
  subscribe(incidentId: string, handlers: IncidentSubscriptionHandlers): Unsubscribe;
}

export interface LiveKitTokenPort {
  issue(input: { incidentId: string; guestSessionId: string }): Promise<{
    serverUrl: string;
    roomName: string;
    participantIdentity: string;
    token: string;
    expiresAt: string;
  }>;
}

export interface VisionResponsePort {
  respond(input: {
    requestId: string;
    status: "accepted" | "declined";
    mediaRef?: string;
  }): Promise<VisionRequest>;
}
