"use client";

import { visionRequestSchema, type VisionRequest } from "@steward/contracts";
import { Room, RoomEvent, Track, type RemoteTrack } from "livekit-client";
import { useEffect, useRef, useState } from "react";

import { StewardLogo } from "../../components/steward-logo";
import { canStartCamera } from "../../lib/vision-consent";

type SessionState = "idle" | "starting" | "connected" | "reconnecting" | "ended" | "failed";

interface ApiFailure { error?: { message?: string } }

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & ApiFailure;
  if (!response.ok) throw new Error(body.error?.message ?? "The request could not be completed.");
  return body;
}

export function VoiceConsole() {
  const [email, setEmail] = useState("");
  const [goal, setGoal] = useState("The front door lock is not opening.");
  const [state, setState] = useState<SessionState>("idle");
  const [message, setMessage] = useState("Microphone off");
  const [muted, setMuted] = useState(false);
  const [visionRequest, setVisionRequest] = useState<VisionRequest | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const audioHostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => {
    const room = roomRef.current;
    roomRef.current = null;
    if (room !== null) void room.disconnect();
  }, []);

  function attachRemoteAudio(track: RemoteTrack) {
    if (track.kind !== Track.Kind.Audio || audioHostRef.current === null) return;
    const element = track.attach();
    element.autoplay = true;
    audioHostRef.current.append(element);
  }

  async function startSession() {
    if (state === "starting" || state === "connected" || email.trim() === "" || goal.trim().length < 3) return;
    setState("starting");
    setMessage("Connecting…");
    try {
      const guest = await readJson<{ session: { id: string } }>(await fetch("/api/guest/demo-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      }));
      const incident = await readJson<{ incident: { id: string } }>(await fetch("/api/incidents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guestSessionId: guest.session.id, goal }),
      }));
      const credentials = await readJson<{ serverUrl: string; token: string }>(await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guestSessionId: guest.session.id, incidentId: incident.incident.id }),
      }));

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      room.on(RoomEvent.Reconnecting, () => {
        setState("reconnecting");
        setMessage("Reconnecting…");
      });
      room.on(RoomEvent.Reconnected, () => {
        setState("connected");
        setMessage("Connected");
      });
      room.on(RoomEvent.Disconnected, () => {
        setState("ended");
        setCameraOn(false);
        setMessage("Call ended");
      });
      room.on(RoomEvent.TrackSubscribed, (track) => attachRemoteAudio(track));
      room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
        const text = new TextDecoder().decode(payload);
        if (topic === "steward.vision-request.v1") {
          try {
            const parsed = visionRequestSchema.parse(JSON.parse(text));
            if (Date.parse(parsed.expiresAt) > Date.now() && parsed.status === "pending") setVisionRequest(parsed);
          } catch {
            setMessage("Camera request unavailable");
          }
        }
        if (topic === "steward.agent-status.v1") {
          try {
            const status = JSON.parse(text) as { message?: unknown };
            if (typeof status.message === "string") setMessage(status.message);
          } catch {
            // Ignore malformed optional status updates.
          }
        }
      });

      await room.connect(credentials.serverUrl, credentials.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      setState("connected");
      setMessage("Connected");
    } catch (error) {
      await roomRef.current?.disconnect();
      roomRef.current = null;
      setState("failed");
      setMessage(error instanceof Error ? error.message : "Voice session could not start.");
    }
  }

  async function publishVisionResponse(status: "accepted" | "declined" | "failed") {
    const room = roomRef.current;
    const request = visionRequest;
    if (room === null || request === null || Date.parse(request.expiresAt) <= Date.now()) {
      setVisionRequest(null);
      setMessage("Camera request expired");
      return;
    }
    if (status === "accepted" && !canStartCamera(request, "accepted")) return;
    if (status === "accepted") {
      try {
        await room.localParticipant.setCameraEnabled(true, {
          facingMode: "environment",
          resolution: { width: 640, height: 480, frameRate: 15 },
        });
        setCameraOn(true);
      } catch {
        status = "failed";
        setMessage("Camera unavailable. Voice is still connected.");
      }
    }
    await room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({ requestId: request.id, status })),
      { reliable: true, topic: "steward.vision-response.v1" },
    );
    if (status === "declined") setMessage("Continuing with voice");
    if (status === "accepted") setMessage("Camera shared for this step");
    setVisionRequest(null);
  }

  async function toggleMute() {
    const room = roomRef.current;
    if (room === null) return;
    await room.localParticipant.setMicrophoneEnabled(muted);
    setMuted((value) => !value);
  }

  async function endSession() {
    const room = roomRef.current;
    if (room === null) return;
    if (cameraOn) await room.localParticipant.setCameraEnabled(false);
    await room.disconnect();
    roomRef.current = null;
  }

  const active = state === "connected" || state === "reconnecting";
  return (
    <section className="voice-console" aria-labelledby="voice-title">
      <StewardLogo className="voice-brand" markClassName="voice-brand-mark" />
      <div className="voice-orb" data-active={active} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="8" y="3" width="8" height="12" rx="4" />
          <path d="M5.5 11.5v.5a6.5 6.5 0 0 0 13 0v-.5M12 18.5V22M8.5 22h7" />
        </svg>
      </div>
      <h1 id="voice-title">Talk to Steward</h1>

      {!active && state !== "starting" ? (
        <div className="field-stack voice-intake">
          <label>
            Email
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          </label>
          <label>
            What happened?
            <textarea value={goal} onChange={(event) => setGoal(event.target.value)} />
          </label>
        </div>
      ) : null}

      <div className="voice-controls">
        {!active ? (
          <button className="button button-primary" type="button" onClick={startSession} disabled={state === "starting" || email.trim() === ""}>
            {state === "starting" ? "Connecting…" : "Start call"}
          </button>
        ) : (
          <>
            <button className="button button-secondary" type="button" onClick={toggleMute}>{muted ? "Unmute" : "Mute"}</button>
            <button className="button button-danger" type="button" onClick={endSession}>End call</button>
          </>
        )}
      </div>

      {visionRequest !== null ? (
        <aside className="vision-request" aria-live="polite">
          <strong>Show Steward the issue?</strong>
          <p>{visionRequest.explanation}</p>
          <p className="vision-question">{visionRequest.question}</p>
          <div className="action-row">
            <button className="button button-primary" type="button" onClick={() => publishVisionResponse("accepted")}>Share camera</button>
            <button className="button button-secondary" type="button" onClick={() => publishVisionResponse("declined")}>Continue without it</button>
          </div>
        </aside>
      ) : null}

      <div className="transcript" role="status" aria-live="polite">
        <strong>{state === "connected" ? "Live" : state === "reconnecting" ? "Reconnecting" : "Call"}</strong>
        <p>{message}</p>
        {cameraOn ? <small>Camera on · turn it off by ending the session</small> : null}
      </div>
      <div ref={audioHostRef} className="remote-audio" aria-hidden="true" />
    </section>
  );
}
