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

function cameraState(value: string | undefined): CameraState {
  return cameraStates.has(value as CameraState) ? (value as CameraState) : "request";
}

function frameIndex(value: string | undefined, scenario: GuestScenarioFixture): number {
  const parsed = Number.parseInt(value ?? "0", 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.min(Math.max(parsed, 0), scenario.frames.length - 1);
}

function connectionContent(state: ConnectionState) {
  const content = {
    connecting: { icon: "·", label: "Connecting", detail: "Preparing the secure voice channel" },
    connected: { icon: "✓", label: "Connected", detail: "Voice help is available" },
    reconnecting: { icon: "↻", label: "Reconnecting", detail: "Keeping your incident open" },
    disconnected: { icon: "—", label: "Disconnected", detail: "Voice channel is not active" },
    failed: { icon: "!", label: "Connection failed", detail: "The call could not be restored" },
  } as const;
  return content[state];
}

function voiceInstruction(frame: GuestTimelineFrame): { title: string; detail: string } {
  const state = frame.voice?.state;
  switch (state) {
    case "listening":
      return {
        title: "Tell me what is happening",
        detail: "Describe what you notice in your own words. You do not need to identify the cause.",
      };
    case "thinking":
      return {
        title: "Checking the next safe step",
        detail: "Steward is reviewing the facts already shared. No external action is being claimed yet.",
      };
    case "speaking":
      return {
        title: "Steward is responding",
        detail: "You can interrupt or correct anything that does not match what you see.",
      };
    case "tool-pending":
      return {
        title: frame.voice?.safeLabel ?? "An external action is pending",
        detail: "Steward is waiting for an actual result. Nothing has been booked or confirmed yet.",
      };
    case "camera-requested":
      return {
        title: "Choose whether to share a live view",
        detail: "Camera access is optional. Voice troubleshooting remains available.",
      };
    case "disconnected":
      return {
        title: "The voice connection paused",
        detail: "Your incident remains open while the connection is restored or you choose another path.",
      };
    case "ended":
      return frame.incident.state === "resolved"
        ? { title: "The call has ended", detail: "The result below is backed by recorded evidence." }
        : { title: "The call has ended", detail: "No verified resolution was recorded." };
    default:
      return {
        title: "Preparing voice help",
        detail: "Steward will show the connection state here before the conversation begins.",
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
          <p>Resolved with verified evidence</p>
          <h2 id="outcome-title">Outcome verified</h2>
          <p>{incident.outcome.summary}</p>
          <small>
            Verified by {incident.outcome.verifiedBy} · {incident.outcome.evidenceRefs.length} evidence
            {incident.outcome.evidenceRefs.length === 1 ? " reference" : " references"}
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
          <p>Attempt failed</p>
          <h2 id="outcome-title">Steward could not complete this call</h2>
          <p>The connection failed before Steward could verify a resolution. No success was recorded.</p>
          <small>Your incident history remains safe. Try again or use the property contact.</small>
        </div>
      </section>
    );
  }

  if (incident.state === "escalated") {
    return (
      <section className={`${styles.outcome} ${styles.incompleteOutcome}`} aria-labelledby="outcome-title">
        <span aria-hidden="true">→</span>
        <div>
          <p>Escalated · incomplete</p>
          <h2 id="outcome-title">A person needs to continue</h2>
          <p>Steward did not have enough verified evidence to close the incident.</p>
          <small>Completed steps are preserved so the property contact can continue safely.</small>
        </div>
      </section>
    );
  }

  const vendorPending = incident.state === "vendor-contacting";
  return (
    <div className={styles.incidentPhase} role="status">
      <span aria-hidden="true">{vendorPending ? "↗" : "○"}</span>
      <p>
        <strong>{vendorPending ? "Vendor or tool action pending" : "Active diagnosis"}</strong>
        {vendorPending
          ? "Waiting for a real response before anything is confirmed."
          : "Steward is still gathering facts. No outcome has been declared."}
      </p>
    </div>
  );
}

function IncidentView({
  frame,
  scenario,
  initialCamera,
  onAdvance,
}: {
  frame: GuestTimelineFrame;
  scenario: GuestScenarioFixture;
  initialCamera: CameraState;
  onAdvance(): void;
}) {
  const connection = connectionContent(frame.connection);
  const instruction = voiceInstruction(frame);

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
        <span className={styles.modeLabel}>Voice</span>
      </section>

      <article className={styles.conversation}>
        <header className={styles.incidentHeader}>
          <p>Steward guest help</p>
          <h1>Help is here.</h1>
          <span>Temporary access · incident {frame.incident.id}</span>
        </header>

        <section className={styles.instruction} aria-labelledby="instruction-title">
          <VoicePresence voice={frame.voice} />
          <p>{frame.voice?.state === "tool-pending" ? "External action" : "Current instruction"}</p>
          <h2 id="instruction-title">{instruction.title}</h2>
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
            initialState={initialCamera}
            onDecline={onAdvance}
          />
        ) : null}

        <Outcome incident={frame.incident} />

        {frame.connection === "reconnecting" || frame.connection === "disconnected" ? (
          <button type="button" className={styles.retryButton}>
            Try voice connection again
          </button>
        ) : null}

        <footer className={styles.guestFooter}>
          <p>
            If there is immediate danger, leave the area and contact local emergency services. Steward
            does not replace emergency response.
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
    <main className={styles.guestShell}>
      <nav className={styles.guestNav} aria-label="Guest navigation">
        <Link href="/" className={styles.guestBrand} aria-label="Steward home">
          <span aria-hidden="true">S</span>
          Steward
        </Link>
        <span>Guest session</span>
      </nav>

      <div className={styles.guestColumn}>
        {access === "valid" ? (
          <IncidentView
            frame={frame}
            scenario={scenario}
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
