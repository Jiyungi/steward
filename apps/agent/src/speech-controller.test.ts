import { describe, expect, it, vi } from "vitest";

import {
  containsCriticalData,
  HumanSpeechController,
  withHumanWait,
} from "./speech-controller.js";

describe("HumanSpeechController", () => {
  it("varies adjacent acknowledgements", () => {
    const controller = new HumanSpeechController();
    const first = controller.selectPendingSpeech({
      operationId: "op-1",
      safeLabel: "the vendor check",
      elapsedMs: 800,
    });
    const second = controller.selectPendingSpeech({
      operationId: "op-2",
      safeLabel: "the vendor check",
      elapsedMs: 900,
    });

    expect(first).not.toBeNull();
    expect(second).not.toBe(first);
  });

  it("uses longer truthful language only after a long wait", () => {
    const controller = new HumanSpeechController();
    expect(
      controller.selectPendingSpeech({
        operationId: "op-1",
        safeLabel: "the approved vendor response",
        elapsedMs: 3_600,
      }),
    ).toMatch(/still|longer/i);
  });

  it("never injects filler into critical speech", () => {
    const controller = new HumanSpeechController();
    const phrase = controller.selectPendingSpeech({
      operationId: "op-1",
      safeLabel: "the payment amount",
      elapsedMs: 3_600,
      risk: "critical",
    });

    expect(containsCriticalData("payment amount")).toBe(true);
    expect(phrase).toBe("the payment amount is still pending. I don’t have a confirmed result yet.");
    expect(phrase).not.toMatch(/\b(?:um+|uh+|mm-hmm)\b/i);
  });

  it("starts the actual operation before wait speech", async () => {
    vi.useFakeTimers();
    const order: string[] = [];
    let resolve!: (value: string) => void;
    const promise = withHumanWait({
      operationId: "op-1",
      safeLabel: "the check",
      controller: new HumanSpeechController(),
      execute: () => {
        order.push("execute");
        return new Promise<string>((done) => {
          resolve = done;
        });
      },
      speak: () => {
        order.push("speak");
      },
    });

    await vi.advanceTimersByTimeAsync(701);
    expect(order).toEqual(["execute", "speak"]);
    resolve("done");
    await expect(promise).resolves.toBe("done");
    vi.useRealTimers();
  });
});
