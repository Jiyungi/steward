import type { AgentRuntimeConfig } from "@steward/config";
import { withIncidentTrace } from "@steward/observability";

export type VoiceChannel = "phone" | "web" | "vendor-call";

interface PendingTurn {
  turnId: string;
  transcript: string;
  startedAt: number;
}

export class VoiceTurnTracer {
  readonly #pending: PendingTurn[] = [];

  constructor(
    private readonly context: {
      incidentId: string;
      sessionId: string;
      correlationId: string;
      channel: VoiceChannel;
      config: AgentRuntimeConfig;
    },
  ) {}

  start(turnId: string, transcript: string): void {
    this.#pending.push({ turnId, transcript, startedAt: performance.now() });
  }

  async complete(responseId: string, assistantResponse: string): Promise<string | undefined> {
    const turn = this.#pending.shift();
    if (!turn) return undefined;

    const traced = await withIncidentTrace({
      context: {
        correlationId: this.context.correlationId,
        incidentId: this.context.incidentId,
        sessionId: this.context.sessionId,
        channel: this.context.channel,
        feature: "voice-turn",
        tags: ["livekit", "deepgram", "a1-responses"],
        ...(this.context.config.LANGFUSE_RELEASE
          ? { version: this.context.config.LANGFUSE_RELEASE }
          : {}),
      },
      input: [{ role: "user", content: turn.transcript }],
      run: async () => ({
        responseId,
        assistantResponse,
        latencyMs: Math.round(performance.now() - turn.startedAt),
        model: this.context.config.OPENAI_MODEL,
      }),
      summarizeOutput: (result) => ({
        responseId: result.responseId,
        assistantResponse: result.assistantResponse,
        latencyMs: result.latencyMs,
        model: result.model,
      }),
    });

    return traced.traceId;
  }
}
