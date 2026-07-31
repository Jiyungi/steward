import { defineAgent, type JobContext, voice } from "@livekit/agents";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as openai from "@livekit/agents-plugin-openai";
import { RoomEvent } from "@livekit/rtc-node";
import { loadAgentRuntimeConfig } from "@steward/config";
import { randomUUID } from "node:crypto";

import {
  ContractEventPublisher,
  LiveKitEventTransport,
} from "./events.js";
import { VoiceLatencyCollector } from "./latency.js";
import { INTERRUPTIBLE_GREETING } from "./prompt.js";
import { wireSessionEvents } from "./session-events.js";
import { HumanSpeechController } from "./speech-controller.js";
import { StewardAgent } from "./steward-agent.js";
import { VoiceTurnTracer, type VoiceChannel } from "./turn-tracing.js";
import { VisionCoordinator } from "./vision.js";

interface RoomMetadata {
  incidentId?: string;
  channel?: VoiceChannel;
  incidentGoal?: string;
}

function readRoomMetadata(metadata: string | undefined): RoomMetadata {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata) as Record<string, unknown>;
    return {
      ...(typeof parsed["incidentId"] === "string"
        ? { incidentId: parsed["incidentId"] }
        : {}),
      ...(parsed["channel"] === "phone" ||
      parsed["channel"] === "web" ||
      parsed["channel"] === "vendor-call"
        ? { channel: parsed["channel"] }
        : {}),
      ...(typeof parsed["incidentGoal"] === "string"
        ? { incidentGoal: parsed["incidentGoal"] }
        : {}),
    };
  } catch {
    return {};
  }
}

function channelForRoom(metadata: RoomMetadata, roomName: string): VoiceChannel {
  if (metadata.channel) return metadata.channel;
  if (roomName.startsWith("vendor-")) return "vendor-call";
  if (roomName.startsWith("web-")) return "web";
  return "phone";
}

function incidentIdFromRoomName(roomName: string): string | undefined {
  if (!roomName.startsWith("incident_")) return undefined;
  const id = roomName.slice("incident_".length).trim();
  return id || undefined;
}

async function runStewardSession(ctx: JobContext): Promise<void> {
  const config = loadAgentRuntimeConfig();
  await ctx.connect();
  const participant = await ctx.waitForParticipant();
  const metadata = {
    ...readRoomMetadata(ctx.room.metadata),
    ...readRoomMetadata(participant.metadata),
  };
  const roomName = ctx.room.name ?? "";
  const incidentId =
    metadata.incidentId?.trim() ||
    incidentIdFromRoomName(roomName) ||
    roomName ||
    `incident-${ctx.job.id}`;
  const channel = channelForRoom(metadata, roomName);
  const correlationId = randomUUID();
  const transport = new LiveKitEventTransport(ctx.room);
  const events = new ContractEventPublisher(incidentId, transport);
  const latency = new VoiceLatencyCollector(incidentId);
  const tracer = new VoiceTurnTracer({
    incidentId,
    sessionId: incidentId,
    correlationId,
    channel,
    config,
  });
  const speech = new HumanSpeechController();
  let session!: voice.AgentSession<{
    incidentId: string;
    channel: VoiceChannel;
    speech: HumanSpeechController;
    vision: VisionCoordinator;
  }>;
  const vision = new VisionCoordinator(events, async (response) => {
    const instructions =
      response.status === "accepted"
        ? "The guest accepted the visual evidence request. Acknowledge briefly, but do not claim you can see anything until an actual frame is available."
        : response.status === "declined"
          ? "The guest declined camera access. Accept that without pressure and continue with the best voice-only diagnostic question."
          : "Camera access failed. Explain that briefly and continue with voice-only troubleshooting.";
    session.generateReply({ instructions, allowInterruptions: true });
  });

  session = new voice.AgentSession({
    userData: { incidentId, channel, speech, vision },
    stt: new deepgram.STTv2({
      apiKey: config.DEEPGRAM_API_KEY,
      model: config.DEEPGRAM_STT_MODEL,
      eagerEotThreshold: 0.4,
      eotThreshold: 0.7,
      eotTimeoutMs: 2_500,
      tags: ["steward", channel],
    }),
    llm: new openai.responses.LLM({
      apiKey: config.OPENAI_API_KEY,
      baseURL: config.OPENAI_BASE_URL,
      model: config.OPENAI_MODEL,
      useWebSocket: false,
      store: false,
      parallelToolCalls: false,
      strictToolSchema: false,
      maxOutputTokens: 256,
      metadata: { application: "steward", channel },
    }),
    tts: new deepgram.TTS({
      apiKey: config.DEEPGRAM_API_KEY,
      model: config.DEEPGRAM_TTS_MODEL,
      speed: config.DEEPGRAM_TTS_SPEED,
    }),
    turnHandling: {
      turnDetection: "stt",
      endpointing: {
        mode: "dynamic",
        minDelay: 250,
        maxDelay: 2_500,
        alpha: 0.9,
      },
      interruption: {
        enabled: true,
        mode: "adaptive",
        discardAudioIfUninterruptible: true,
        minDuration: 250,
        minWords: 0,
        falseInterruptionTimeout: 1_200,
        resumeFalseInterruption: true,
        backchannelBoundary: [700, 700],
      },
      preemptiveGeneration: {
        enabled: true,
        preemptiveTts: false,
        maxSpeechDuration: 10_000,
        maxRetries: 2,
      },
    },
    maxToolSteps: 4,
    useTtsAlignedTranscript: true,
  });

  wireSessionEvents({ session, events, latency, tracer });

  ctx.room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
    void vision.handleData(topic, payload).catch((error: unknown) => {
      console.error("vision_response_rejected", {
        incidentId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    });
  });

  ctx.addShutdownCallback(async () => {
    await events.voice({
      version: 1,
      incidentId,
      state: "ended",
      safeLabel: "Call ended",
      occurredAt: new Date().toISOString(),
    });
    const { initializeObservability } = await import("@steward/observability");
    await initializeObservability().forceFlush();
  });

  await session.start({
    agent: new StewardAgent(events, vision, metadata.incidentGoal),
    room: ctx.room,
    record: {
      audio: false,
      transcript: false,
      traces: true,
      logs: true,
      redaction: true,
    },
  });
  await transport.flush();

  session.say(INTERRUPTIBLE_GREETING, {
    allowInterruptions: true,
    addToChatCtx: true,
  });
}

export default defineAgent({
  entry: runStewardSession,
});
