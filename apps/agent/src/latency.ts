export type VoiceMetric = { type: string; [key: string]: unknown };

export interface LatencyRecord {
  metric: "llm" | "tts" | "end-of-turn" | "interruption" | "turn-to-speech";
  durationMs: number;
  incidentId: string;
  turnId?: string;
}

export class VoiceLatencyCollector {
  readonly #records: LatencyRecord[] = [];
  readonly #turnEndedAt = new Map<string, number>();
  #activeTurnId?: string;

  constructor(readonly incidentId: string) {}

  markTurnFinal(turnId: string, at = performance.now()): void {
    this.#activeTurnId = turnId;
    this.#turnEndedAt.set(turnId, at);
  }

  markSpeechStarted(at = performance.now()): LatencyRecord | undefined {
    const turnId = this.#activeTurnId;
    if (!turnId) return undefined;
    const endedAt = this.#turnEndedAt.get(turnId);
    if (endedAt === undefined) return undefined;

    const record: LatencyRecord = {
      metric: "turn-to-speech",
      durationMs: Math.max(0, Math.round(at - endedAt)),
      incidentId: this.incidentId,
      turnId,
    };
    this.#records.push(record);
    this.#turnEndedAt.delete(turnId);
    return record;
  }

  observe(metric: VoiceMetric): LatencyRecord | undefined {
    let record: LatencyRecord | undefined;
    switch (metric.type) {
      case "llm_metrics":
        record = this.#make("llm", numericMetric(metric, "ttftMs"));
        break;
      case "tts_metrics":
        record = this.#make("tts", numericMetric(metric, "ttfbMs"));
        break;
      case "eou_metrics":
        record = this.#make(
          "end-of-turn",
          numericMetric(metric, "endOfUtteranceDelayMs"),
        );
        break;
      case "interruption_metrics":
        record = this.#make(
          "interruption",
          numericMetric(metric, "detectionDelay"),
        );
        break;
      default:
        return undefined;
    }
    if (!record) return undefined;
    this.#records.push(record);
    return record;
  }

  summary(): { count: number; medianMs: number | null; p95Ms: number | null } {
    const values = this.#records
      .map((record) => record.durationMs)
      .sort((left, right) => left - right);
    if (values.length === 0) {
      return { count: 0, medianMs: null, p95Ms: null };
    }
    return {
      count: values.length,
      medianMs: percentile(values, 0.5),
      p95Ms: percentile(values, 0.95),
    };
  }

  #make(metric: LatencyRecord["metric"], durationMs: number): LatencyRecord {
    return {
      metric,
      durationMs: Math.max(0, Math.round(durationMs)),
      incidentId: this.incidentId,
      ...(this.#activeTurnId ? { turnId: this.#activeTurnId } : {}),
    };
  }
}

function numericMetric(metric: VoiceMetric, key: string): number {
  const value = metric[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function percentile(values: number[], quantile: number): number {
  const index = Math.min(values.length - 1, Math.ceil(values.length * quantile) - 1);
  return values[Math.max(0, index)]!;
}
