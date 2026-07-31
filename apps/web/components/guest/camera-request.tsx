"use client";

import type { VisionRequest } from "@steward/contracts";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import styles from "./guest.module.css";

export type CameraState =
  | "request"
  | "requesting"
  | "declined"
  | "permission-denied"
  | "unavailable"
  | "preview"
  | "disconnected";

interface CameraRequestProps {
  initialState: CameraState;
  request: VisionRequest;
  onDecline(): void;
}

function cameraErrorState(error: unknown): CameraState {
  if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
    return "permission-denied";
  }
  return "unavailable";
}

export function CameraRequest({ initialState, request, onDecline }: CameraRequestProps) {
  const [cameraState, setCameraState] = useState<CameraState>(initialState);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reducedMotion = useReducedMotion() ?? false;

  useEffect(() => {
    const video = videoRef.current;
    if (video !== null && streamRef.current !== null) {
      video.srcObject = streamRef.current;
    }
  }, [cameraState]);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const acceptCamera = async () => {
    setCameraState("requesting");

    const getUserMedia = navigator.mediaDevices?.getUserMedia;
    if (getUserMedia === undefined) {
      setCameraState("unavailable");
      return;
    }

    try {
      const stream = await getUserMedia.call(navigator.mediaDevices, {
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      setCameraState("preview");
    } catch (error) {
      setCameraState(cameraErrorState(error));
    }
  };

  const returnToVoice = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraState("disconnected");
  };

  const declineCamera = () => {
    setCameraState("declined");
    onDecline();
  };

  const requestVisible = cameraState === "request" || cameraState === "requesting";

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.section
        key={cameraState}
        className={styles.cameraSection}
        aria-labelledby="camera-title"
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
        transition={{ duration: reducedMotion ? 0 : 0.18 }}
      >
        {requestVisible ? (
          <>
            <div className={styles.inlineHeading}>
              <span className={styles.cameraGlyph} aria-hidden="true">
                ◉
              </span>
              <div>
                <p>Camera requested</p>
                <h2 id="camera-title">A live view may help</h2>
              </div>
            </div>
            <p className={styles.cameraQuestion}>{request.question}</p>
            <p>{request.explanation}</p>
            <p className={styles.permissionCopy}>
              Your browser will ask for permission only after you choose “Accept camera.” You can
              continue by voice if you decline.
            </p>
            <div className={styles.cameraActions}>
              <button type="button" onClick={acceptCamera} disabled={cameraState === "requesting"}>
                {cameraState === "requesting" ? "Requesting browser permission…" : "Accept camera"}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={declineCamera}>
                Continue by voice
              </button>
            </div>
          </>
        ) : null}

        {cameraState === "preview" ? (
          <>
            <div className={styles.inlineHeading}>
              <span className={styles.liveGlyph} aria-hidden="true">
                ●
              </span>
              <div>
                <p>Camera connected</p>
                <h2 id="camera-title">Show the relevant area</h2>
              </div>
            </div>
            <div className={styles.previewFrame}>
              <video ref={videoRef} autoPlay muted playsInline aria-label="Live camera preview" />
              <span>Live preview</span>
            </div>
            <p>Steward will use the view only for the current diagnostic question.</p>
            <button type="button" className={styles.secondaryButton} onClick={returnToVoice}>
              Stop camera and return to voice
            </button>
          </>
        ) : null}

        {cameraState === "declined" ? (
          <CameraRecovery
            title="Camera declined"
            detail="No camera permission was requested. Voice troubleshooting is still available."
          />
        ) : null}
        {cameraState === "permission-denied" ? (
          <CameraRecovery
            title="Camera permission denied"
            detail="The browser blocked camera access. Nothing was shared, and the voice connection can continue safely."
          />
        ) : null}
        {cameraState === "unavailable" ? (
          <CameraRecovery
            title="Camera unavailable"
            detail="Steward could not start a camera on this device. Your incident remains open and voice troubleshooting is still available."
          />
        ) : null}
        {cameraState === "disconnected" ? (
          <CameraRecovery
            title="Camera disconnected"
            detail="The video stream has stopped. Steward will return to voice-only troubleshooting."
          />
        ) : null}
      </motion.section>
    </AnimatePresence>
  );
}

function CameraRecovery({ title, detail }: { title: string; detail: string }) {
  return (
    <div className={styles.cameraRecovery} role="status">
      <span className={styles.neutralGlyph} aria-hidden="true">
        —
      </span>
      <div>
        <h2 id="camera-title">{title}</h2>
        <p>{detail}</p>
        <strong>Continue speaking when you’re ready.</strong>
      </div>
    </div>
  );
}
