export type SpeechRisk = "normal" | "critical";

export interface PendingOperationSpeech {
  operationId: string;
  safeLabel: string;
  elapsedMs: number;
  risk?: SpeechRisk;
}

const shortAcknowledgements = [
  "Mm-hmm, I’m checking that now.",
  "Okay, give me just a moment.",
  "Uhh, I’m pulling that up now.",
  "Got it—one second while I check.",
] as const;

const longUpdates = [
  (label: string) => `I’m still waiting on ${label}. I don’t have a result yet.`,
  (label: string) => `${label} is taking a little longer. It’s still pending.`,
  (label: string) => `I’m still on ${label}; the provider hasn’t responded yet.`,
] as const;

const criticalDataPattern =
  /\b(?:price|amount|dollar|payment|code|pin|address|emergency|fire|gas|electric|evacuate|safety|confirmed|resolved)\b/i;

function cleanSafeLabel(label: string): string {
  const cleaned = label.trim().replace(/[.!?]+$/g, "");
  return cleaned || "that check";
}

export function containsCriticalData(value: string): boolean {
  return criticalDataPattern.test(value);
}

export class HumanSpeechController {
  readonly #recent: string[] = [];
  #shortCursor = 0;
  #longCursor = 0;

  selectPendingSpeech(context: PendingOperationSpeech): string | null {
    if (context.elapsedMs < 700) {
      return null;
    }

    const label = cleanSafeLabel(context.safeLabel);
    const critical = context.risk === "critical" || containsCriticalData(label);

    if (critical) {
      if (context.elapsedMs < 3_500) {
        return null;
      }
      return this.#remember(`${label} is still pending. I don’t have a confirmed result yet.`);
    }

    if (context.elapsedMs >= 3_500) {
      return this.#pickLong(label);
    }

    return this.#pickShort();
  }

  get recentSpeechPatterns(): readonly string[] {
    return this.#recent;
  }

  #pickIndex(length: number, cursor: number, render: (index: number) => string): number {
    for (let offset = 0; offset < length; offset += 1) {
      const candidate = (cursor + offset) % length;
      if (render(candidate) !== this.#recent.at(-1)) {
        return candidate;
      }
    }
    return cursor % length;
  }

  #pickShort(): string {
    const index = this.#pickIndex(
      shortAcknowledgements.length,
      this.#shortCursor,
      (candidate) => shortAcknowledgements[candidate]!,
    );
    this.#shortCursor = index + 1;
    return this.#remember(shortAcknowledgements[index]!);
  }

  #pickLong(label: string): string {
    const index = this.#pickIndex(
      longUpdates.length,
      this.#longCursor,
      (candidate) => longUpdates[candidate]!(label),
    );
    this.#longCursor = index + 1;
    return this.#remember(longUpdates[index]!(label));
  }

  #remember(phrase: string): string {
    this.#recent.push(phrase);
    if (this.#recent.length > 8) {
      this.#recent.shift();
    }
    return phrase;
  }
}

export async function withHumanWait<T>(options: {
  operationId: string;
  safeLabel: string;
  risk?: SpeechRisk;
  controller: HumanSpeechController;
  speak: (text: string) => Promise<void> | void;
  execute: () => Promise<T>;
  shortDelayMs?: number;
  longDelayMs?: number;
}): Promise<T> {
  const startedAt = performance.now();
  let pending = true;

  // Invoke the real operation before scheduling any acknowledgement.
  const operation = options.execute();
  const timers: ReturnType<typeof setTimeout>[] = [];

  const schedule = (delayMs: number): void => {
    timers.push(
      setTimeout(() => {
        if (!pending) return;
        const phrase = options.controller.selectPendingSpeech({
          operationId: options.operationId,
          safeLabel: options.safeLabel,
          elapsedMs: performance.now() - startedAt,
          ...(options.risk ? { risk: options.risk } : {}),
        });
        if (phrase) {
          void options.speak(phrase);
        }
      }, delayMs),
    );
  };

  schedule(options.shortDelayMs ?? 700);
  schedule(options.longDelayMs ?? 3_500);

  try {
    return await operation;
  } finally {
    pending = false;
    for (const timer of timers) clearTimeout(timer);
  }
}
