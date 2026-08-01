import {
  AgentSessionEventTypes,
  type AgentSession,
  type AgentState,
} from "@livekit/agents";
import { randomUUID } from "node:crypto";

import type { ContractEventPublisher } from "./events.js";
import type { VoiceLatencyCollector, VoiceMetric } from "./latency.js";
import type { VoiceTurnTracer } from "./turn-tracing.js";

const systemActor = { kind: "system" as const, component: "agent" as const };

function statusForAgentState(state: AgentState) {
  switch (state) {
    case "idle":
    case "listening":
      return "listening" as const;
    case "initializing":
    case "thinking":
      return "thinking" as const;
    case "speaking":
      return "speaking" as const;
  }
}

export function wireSessionEvents<UserData>(options: {
  session: AgentSession<UserData>;
  events: ContractEventPublisher;
  latency: VoiceLatencyCollector;
  tracer: VoiceTurnTracer;
  onUnrecoverableLlmError?: () => void;
}): void {
  let activeTurnId: string | undefined;
  let activeResponseId: string | undefined;
  let agentState: AgentState = "initializing";
  let failureAnnounced = false;

  const safely = (operation: () => Promise<void>): void => {
    void operation().catch((error: unknown) => {
      console.error("voice_event_handler_failed", {
        incidentId: options.events.incidentId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    });
  };

  options.session.on(AgentSessionEventTypes.UserInputTranscribed, (event) => {
    if (!event.isFinal || !event.transcript.trim()) return;
    const turnId = event.itemId || randomUUID();
    activeTurnId = turnId;
    options.latency.markTurnFinal(turnId);
    options.tracer.start(turnId, event.transcript);

    safely(() =>
      Promise.all([
        options.events.incident({
          version: 1,
          type: "voice.turn.received",
          incidentId: options.events.incidentId,
          eventId: randomUUID(),
          occurredAt: new Date(event.createdAt).toISOString(),
          actor: systemActor,
          payload: {
            turnId,
            transcript: event.transcript,
            confidence: null,
          },
        }),
        options.events.transcript({
          version: 1,
          type: "transcript",
          incidentId: options.events.incidentId,
          turnId,
          role: "user",
          text: event.transcript,
          isFinal: true,
          occurredAt: new Date(event.createdAt).toISOString(),
        }),
      ]).then(() => undefined),
    );
  });

  options.session.on(AgentSessionEventTypes.AgentStateChanged, (event) => {
    agentState = event.newState;
    if (event.newState === "speaking") {
      const record = options.latency.markSpeechStarted();
      if (record) console.info("voice_latency", record);
    }
    safely(() =>
      options.events.voice({
        version: 1,
        incidentId: options.events.incidentId,
        state: statusForAgentState(event.newState),
        occurredAt: new Date(event.createdAt).toISOString(),
      }),
    );
  });

  options.session.on(AgentSessionEventTypes.SpeechCreated, (event) => {
    if (event.source === "say") return;
    activeResponseId = event.speechHandle.id;
    safely(() =>
      options.events.incident({
        version: 1,
        type: "voice.response.started",
        incidentId: options.events.incidentId,
        eventId: randomUUID(),
        occurredAt: new Date(event.createdAt).toISOString(),
        actor: systemActor,
        payload: {
          turnId: activeTurnId ?? randomUUID(),
          responseId: activeResponseId!,
        },
      }),
    );
  });

  options.session.on(AgentSessionEventTypes.UserStateChanged, (event) => {
    if (event.newState !== "speaking" || agentState !== "speaking") return;
    safely(() =>
      options.events.incident({
        version: 1,
        type: "voice.interrupted",
        incidentId: options.events.incidentId,
        eventId: randomUUID(),
        occurredAt: new Date(event.createdAt).toISOString(),
        actor: systemActor,
        payload: { turnId: activeTurnId ?? randomUUID(), atCharacter: null },
      }),
    );
  });

  options.session.on(AgentSessionEventTypes.ConversationItemAdded, (event) => {
    if (event.item.type !== "message" || event.item.role !== "assistant") return;
    const output = event.item.textContent?.trim();
    if (!output) return;
    safely(async () => {
      await options.events.transcript({
        version: 1,
        type: "transcript",
        incidentId: options.events.incidentId,
        turnId: activeTurnId ?? event.item.id,
        role: "assistant",
        text: output,
        isFinal: true,
        occurredAt: new Date(event.createdAt).toISOString(),
      });
      await options.tracer.complete(activeResponseId ?? event.item.id, output);
    });
  });

  options.session.on(AgentSessionEventTypes.MetricsCollected, (event) => {
    const record = options.latency.observe(event.metrics as VoiceMetric);
    if (record) console.info("voice_latency", record);
  });

  options.session.on(AgentSessionEventTypes.Error, (event) => {
    const recoverable = "recoverable" in event.error ? event.error.recoverable : undefined;
    console.error("voice_runtime_error", {
      incidentId: options.events.incidentId,
      errorType: event.error.type,
      recoverable,
    });
    if (
      event.error.type === "llm_error" &&
      recoverable === false &&
      !failureAnnounced
    ) {
      failureAnnounced = true;
      options.onUnrecoverableLlmError?.();
    }
  });

  options.session.on(AgentSessionEventTypes.Close, (event) => {
    safely(async () => {
      await options.events.voice({
        version: 1,
        incidentId: options.events.incidentId,
        state: "ended",
        safeLabel: "Call ended",
        occurredAt: new Date(event.createdAt).toISOString(),
      });
      console.info("voice_session_summary", {
        incidentId: options.events.incidentId,
        closeReason: event.reason,
        latency: options.latency.summary(),
      });
    });
  });
}
