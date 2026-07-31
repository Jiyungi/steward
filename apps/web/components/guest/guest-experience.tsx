"use client";

import {
  createGuestFixtureAdapter,
  type ConnectionState,
  type GuestScenarioFixture,
  type GuestTimelineFrame,
  type IncidentSnapshot,
  type VoiceStatusEvent,
} from "@steward/contracts";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  getGuestPresentation,
  type GuestFixtureName,
} from "../../lib/guest-presentations";
import { AccessView, type AccessState } from "./access-view";
import { CameraRequest, type CameraState } from "./camera-request";
import { DevelopmentSwitcher } from "./development-switcher";
import { StewardLogo } from "../steward-logo";
import styles from "./guest.module.css";

interface GuestExperienceProps {
  initialAccess: string | undefined;
  initialCamera: string | undefined;
  initialFixture: string | undefined;
  initialFrame: string | undefined;
}

const accessStates = new Set<AccessState>([
  "validating",
  "verify-email",
  "demo-entry",
  "valid",
  "expired",
  "revoked",
]);

const cameraStates = new Set<CameraState>([
  "request",
  "requesting",
  "declined",
  "permission-denied",
  "unavailable",
  "preview",
  "disconnected",
]);

function accessState(value: string | undefined): AccessState {
  return accessStates.has(value as AccessState) ? (value as AccessState) : "valid";
}

function cameraState(value: string | undefined): CameraState | null {
  return cameraStates.has(value as CameraState) ? (value as CameraState) : null;
}

function frameIndex(value: string | undefined, scenario: GuestScenarioFixture): number {
  const parsed = Number.parseInt(value ?? "0", 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.min(Math.max(parsed, 0), scenario.frames.length - 1);
}

function connectionContent(state: ConnectionState) {
  const content = {
    connecting: { icon: "·", label: "Connecting", detail: "One moment" },
    connected: { icon: "✓", label: "Connected", detail: "Voice is ready" },
    reconnecting: { icon: "↻", label: "Reconnecting", detail: "Your request stays open" },
    disconnected: { icon: "—", label: "Disconnected", detail: "Voice is off" },
    failed: { icon: "!", label: "Connection failed", detail: "Try again" },
  } as const;
  return content[state];
}

function voiceInstruction(frame: GuestTimelineFrame): { title: string; detail: string } {
  const state = frame.voice?.state;
  switch (state) {
    case "listening":
      return {
        title: "Tell me what is happening",
        detail: "Describe what you see or hear.",
      };
    case "thinking":
      return {
        title: "Checking the next step",
        detail: "One moment.",
      };
    case "speaking":
      return {
        title: "Steward is responding",
        detail: "You can interrupt at any time.",
      };
    case "tool-pending":
      return {
        title: frame.voice?.safeLabel ?? "An external action is pending",
        detail: "Waiting for a response.",
      };
    case "camera-requested":
      return {
        title: "Choose whether to share a live view",
        detail: "You can continue without the camera.",
      };
    case "disconnected":
      return {
        title: "The voice connection paused",
        detail: "Your request is still open.",
      };
    case "ended":
      return frame.incident.state === "resolved"
        ? { title: "Call ended", detail: "The result was verified." }
        : { title: "Call ended", detail: "No result was verified." };
    default:
      return {
        title: "Connecting",
        detail: "One moment.",
      };
  }
}

function VoicePresence({ voice }: { voice: VoiceStatusEvent | null }) {
  const reducedMotion = useReducedMotion() ?? false;
  const active = voice?.state === "listening" || voice?.state === "speaking";
  return (
    <div className={styles.voicePresence} aria-hidden="true">
      <motion.span
        animate={active && !reducedMotion ? { scale: [0.92, 1.08, 0.92], opacity: [0.62, 1, 0.62] } : { scale: 1, opacity: 0.82 }}
        transition={active && !reducedMotion ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }}
      />
      <span />
    </div>
  );
}

function Outcome({ incident }: { incident: IncidentSnapshot }) {
  if (incident.state === "resolved" && incident.outcome !== null) {
    return (
      <section className={`${styles.outcome} ${styles.resolvedOutcome}`} aria-labelledby="outcome-title">
        <span aria-hidden="true">✓</span>
        <div>
          <p>Resolved</p>
          <h2 id="outcome-title">Verified</h2>
          <p>{incident.outcome.summary}</p>
          <small>
            {incident.outcome.evidenceRefs.length} evidence
            {incident.outcome.evidenceRefs.length === 1 ? " item" : " items"} · {incident.outcome.verifiedBy}
          </small>
        </div>
      </section>
    );
  }

  if (incident.state === "failed") {
    return (
      <section className={`${styles.outcome} ${styles.failedOutcome}`} aria-labelledby="outcome-title">
        <span aria-hidden="true">!</span>
        <div>
          <p>Call failed</p>
          <h2 id="outcome-title">Nothing was verified</h2>
          <p>Try again or contact the property.</p>
        </div>
      </section>
    );
  }

  if (incident.state === "escalated") {
    return (
      <section className={`${styles.outcome} ${styles.incompleteOutcome}`} aria-labelledby="outcome-title">
        <span aria-hidden="true">→</span>
        <div>
          <p>Escalated</p>
          <h2 id="outcome-title">The property team will continue</h2>
          <p>Steward did not have enough evidence to close this.</p>
        </div>
      </section>
    );
  }

  const vendorPending = incident.state === "vendor-contacting";
  return (
    <div className={styles.incidentPhase} role="status">
      <span aria-hidden="true">{vendorPending ? "↗" : "○"}</span>
      <p>
        <strong>{vendorPending ? "Waiting for a vendor" : "In progress"}</strong>
        {vendorPending
          ? "Nothing is confirmed yet."
          : "Steward is gathering the details."}
      </p>
    </div>
  );
}

function IncidentView({
  frame,
  initialCamera,
  onAdvance,
}: {
  frame: GuestTimelineFrame;
  initialCamera: CameraState | null;
  onAdvance(): void;
}) {
  const connection = connectionContent(frame.connection);
  const instruction = voiceInstruction(frame);
  const effectiveCameraState =
    initialCamera ?? (frame.visionRequest?.status === "declined" ? "declined" : "request");

  return (
    <>
      <section className={styles.connectionBar} aria-label="Current call and connection state">
        <span className={`${styles.connectionIcon} ${styles[`connection-${frame.connection}`]}`} aria-hidden="true">
          {connection.icon}
        </span>
        <p aria-live="polite">
          <strong>{connection.label}</strong>
          <span>{connection.detail}</span>
        </p>
        <span className={styles.modeLabel}>
          <span className={styles.levelMeter} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          Voice line
        </span>
      </section>

      <article className={styles.conversation}>
        <section className={styles.instruction} aria-labelledby="instruction-title">
          <VoicePresence voice={frame.voice} />
          <h1 id="instruction-title">{instruction.title}</h1>
          <p>{instruction.detail}</p>
        </section>

        {frame.notice !== null ? (
          <p className={styles.notice} role="status">
            <span aria-hidden="true">i</span>
            {frame.notice}
          </p>
        ) : null}

        {frame.visionRequest !== null ? (
          <CameraRequest
            key={`${frame.visionRequest.id}-${initialCamera}`}
            request={frame.visionRequest}
            initialState={effectiveCameraState}
            onDecline={onAdvance}
          />
        ) : null}

        <Outcome incident={frame.incident} />

        {frame.connection === "reconnecting" ? (
          <button type="button" className={styles.retryButton} onClick={onAdvance}>
            Try voice connection again
          </button>
        ) : null}

        {frame.connection === "disconnected" ? (
          <Link className={styles.retryButton} href="/guest?access=valid&fixture=connected">
            Try voice connection again
          </Link>
        ) : null}

        <footer className={styles.guestFooter}>
          <p>
            In immediate danger, leave the area and call emergency services.
          </p>
        </footer>
      </article>
    </>
  );
}

export function GuestExperience({
  initialAccess,
  initialCamera,
  initialFixture,
  initialFrame,
}: GuestExperienceProps) {
  const scenario = useMemo(() => getGuestPresentation(initialFixture), [initialFixture]);
  const adapter = useMemo(() => createGuestFixtureAdapter(scenario), [scenario]);
  const requestedIndex = frameIndex(initialFrame, scenario);
  const [access, setAccess] = useState<AccessState>(() => accessState(initialAccess));
  const [currentIndex, setCurrentIndex] = useState(requestedIndex);
  const [frame, setFrame] = useState<GuestTimelineFrame>(() => scenario.frames[requestedIndex] ?? scenario.frames[0]!);

  useEffect(() => {
    adapter.reset();
    for (let index = 0; index < requestedIndex; index += 1) adapter.advance();
    setCurrentIndex(requestedIndex);
    setFrame(adapter.current());

    return adapter.subscribe(scenario.frames[0]?.incident.id ?? "fixture-incident", {
      onConnectionState: () => undefined,
      onSnapshot: () => undefined,
      onEvent: () => undefined,
      onVoiceStatus: () => undefined,
      onError: () => undefined,
    });
  }, [adapter, requestedIndex, scenario]);

  const advance = () => {
    const next = adapter.advance();
    setFrame(next);
    setCurrentIndex((index) => Math.min(index + 1, scenario.frames.length - 1));
  };

  const fixtureName = (initialFixture ?? "connected") as GuestFixtureName;

  return (
    <main className={`${styles.guestShell} guest-theme`}>
      <nav className={styles.guestNav} aria-label="Guest navigation">
        <Link href="/" className={styles.guestBrand} aria-label="Steward home">
          <StewardLogo markClassName={styles.guestBrandMark} />
        </Link>
        <span className={styles.sessionLabel}>
          <i aria-hidden="true" />
          Temporary guest
        </span>
      </nav>

      <div className={styles.guestColumn}>
        {access === "valid" ? (
          <IncidentView
            frame={frame}
            initialCamera={cameraState(initialCamera)}
            onAdvance={advance}
          />
        ) : (
          <AccessView state={access} onContinue={() => setAccess("valid")} />
        )}
      </div>

      <DevelopmentSwitcher
        access={access}
        fixture={fixtureName}
        frameIndex={currentIndex}
        frameCount={scenario.frames.length}
        onAdvance={advance}
      />
    </main>
  );
}
