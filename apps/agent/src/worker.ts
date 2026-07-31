import { defineAgent, type JobContext, llm, voice } from "@livekit/agents";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import { RoomEvent } from "@livekit/rtc-node";
import { loadAgentRuntimeConfig, loadDatabaseConfig, loadProviderConfig } from "@steward/config";
import { randomUUID } from "node:crypto";

import {
  ContractEventPublisher,
  LiveKitEventTransport,
} from "./events.js";
import { AgentActionRuntime, createAgentActionTools } from "./action-tools.js";
import { probeA1RuntimeCapabilities } from "./a1-capabilities.js";
import { A1ResponsesLLM } from "./a1-responses-llm.js";
import { AgentIncidentPersistence } from "./incident-persistence.js";
import { VoiceLatencyCollector } from "./latency.js";
import { buildInterruptibleGreeting } from "./prompt.js";
import { wireSessionEvents } from "./session-events.js";
import { HumanSpeechController } from "./speech-controller.js";
import { StewardAgent } from "./steward-agent.js";
import { VoiceTurnTracer, type VoiceChannel } from "./turn-tracing.js";
import { LiveKitVisionFrameSource } from "./video-frame-source.js";
import { VisionCoordinator } from "./vision.js";

interface RoomMetadata {
  incidentId?: string;
  channel?: VoiceChannel;
  incidentGoal?: string;
  vendorId?: string;
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
      ...(typeof parsed["vendorId"] === "string"
        ? { vendorId: parsed["vendorId"] }
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
  const capabilities = await probeA1RuntimeCapabilities(config);
  await ctx.connect();
  const participant = await ctx.waitForParticipant();
  const metadata = {
    ...readRoomMetadata(ctx.room.metadata),
    ...readRoomMetadata(ctx.job.metadata),
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
  const databaseConfig = loadDatabaseConfig();
  const providerConfig = loadProviderConfig();
  const persistence = new AgentIncidentPersistence({
    url: databaseConfig.NEXT_PUBLIC_SUPABASE_URL,
    secretKey: databaseConfig.SUPABASE_SECRET_KEY,
  });
  await persistence.ensureIncident({
    incidentId,
    participantIdentity: participant.identity,
    ...(metadata.incidentGoal === undefined ? {} : { incidentGoal: metadata.incidentGoal }),
    guestExpiryDays: config.GUEST_LINK_EXPIRY_DAYS,
  });
  const transport = new LiveKitEventTransport(ctx.room);
  const events = new ContractEventPublisher(
    incidentId,
    transport,
    (event) => persistence.persist(event),
  );
  const latency = new VoiceLatencyCollector(incidentId);
  const tracer = new VoiceTurnTracer({
    incidentId,
    sessionId: incidentId,
    correlationId,
    channel,
    config,
  });
  const speech = new HumanSpeechController();
  const actionRuntime = new AgentActionRuntime(incidentId, databaseConfig, providerConfig);
  const frameSource = new LiveKitVisionFrameSource(ctx.room, participant);
  let session!: voice.AgentSession<{
    incidentId: string;
    channel: VoiceChannel;
    speech: HumanSpeechController;
    vision: VisionCoordinator;
  }>;
  const vision = new VisionCoordinator(events, async (response, request) => {
    if (response.status !== "accepted") {
      const instructions = response.status === "declined"
        ? "The guest declined camera access. Accept that without pressure and continue with the best voice-only diagnostic question."
        : "Camera access failed. Explain that briefly and continue with voice-only troubleshooting.";
      session.generateReply({ instructions, allowInterruptions: true });
      return;
    }

    const frame = await frameSource.captureFrame();
    if (frame === null) {
      session.generateReply({
        instructions: "The guest accepted camera access, but no usable frame arrived. State that plainly and continue with voice-only troubleshooting.",
        allowInterruptions: true,
      });
      return;
    }

    const evidenceRef = `vision-frame:${request.id}`;
    await events.incident({
      version: 1,
      type: "evidence.recorded",
      incidentId,
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      actor: { kind: "system", component: "agent" },
      payload: {
        evidenceRef,
        kind: "video-frame",
        summary: "A current consented camera frame was supplied for one diagnostic inference; the raw frame was not stored.",
      },
    });
    const userMessage = new llm.ChatMessage({
      role: "user",
      content: [
        `Inspect only this current camera frame to answer the open diagnostic question: ${request.question} Describe what is actually visible. If it is unrelated, dark, blurry, blocked, or contradictory, say which uncertainty applies. Do not infer an object, defect, or outcome that the frame does not support.`,
        llm.createImageContent({ image: frame, inferenceDetail: "high" }),
      ],
      extra: { visionRequestId: request.id, evidenceRef },
    });
    session.generateReply({
      userInput: userMessage,
      instructions: "Use the same reasoning model for this visual turn. Give one concise observation and one useful next question. Never claim the incident is resolved from a single frame.",
      allowInterruptions: true,
    });
  });

  session = new voice.AgentSession({
    userData: { incidentId, channel, speech, vision },
    stt: new deepgram.STTv2({
      apiKey: config.DEEPGRAM_API_KEY,
      model: config.DEEPGRAM_STT_MODEL,
      eagerEotThreshold: 0.35,
      eotThreshold: 0.65,
      eotTimeoutMs: 1_500,
      tags: ["steward", channel],
    }),
    llm: new A1ResponsesLLM(config),
    tts: new deepgram.TTS({
      apiKey: config.DEEPGRAM_API_KEY,
      model: config.DEEPGRAM_TTS_MODEL,
      speed: config.DEEPGRAM_TTS_SPEED,
    }),
    turnHandling: {
      turnDetection: "stt",
      endpointing: {
        mode: "dynamic",
        minDelay: 200,
        maxDelay: 1_500,
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
        preemptiveTts: true,
        maxSpeechDuration: 10_000,
        maxRetries: 2,
      },
    },
    maxToolSteps: 4,
    useTtsAlignedTranscript: true,
  });

  const actionTools = createAgentActionTools({
    runtime: actionRuntime,
    channel,
    ...(metadata.vendorId === undefined ? {} : { vendorId: metadata.vendorId }),
    speech,
    speak: (text) => {
      session.say(text, { allowInterruptions: true, addToChatCtx: false });
    },
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
    frameSource.dispose();
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
    agent: new StewardAgent(events, vision, metadata.incidentGoal, actionTools, {
      enableVision: channel === "web" && capabilities.visionInput,
      audience: channel === "vendor-call" ? "vendor" : "guest",
    }),
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

  session.say(
    channel === "vendor-call"
      ? "Hi, this is Steward calling about a property service request. Are you available to discuss the job?"
      : buildInterruptibleGreeting(metadata.incidentGoal),
  {
    allowInterruptions: true,
    addToChatCtx: true,
  });
}

export default defineAgent({
  entry: runStewardSession,
});
