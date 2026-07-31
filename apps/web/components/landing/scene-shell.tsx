"use client";

import { lazy, Suspense, useEffect, useState } from "react";

import { SceneFallback } from "./scene-fallback";
import styles from "./scene.module.css";

const LazyPropertyScene = lazy(async () => import("./property-scene"));

type SceneState = "waiting" | "ready" | "enhanced" | "unsupported";

const storyStages = [
  { label: "Signal", detail: "A guest need enters the system." },
  { label: "Coordinate", detail: "Steward keeps the context intact." },
  { label: "Act", detail: "The right person or tool responds." },
  { label: "Verify", detail: "Evidence closes the loop." },
] as const;

function supportsWebGl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function SceneShell() {
  const [activeStage, setActiveStage] = useState(0);
  const [sceneState, setSceneState] = useState<SceneState>("waiting");

  useEffect(() => {
    if (!supportsWebGl()) {
      setSceneState("unsupported");
      return;
    }

    const activate = () => setSceneState("ready");
    const requestIdle = Reflect.get(window, "requestIdleCallback") as
      | ((callback: () => void, options: { timeout: number }) => number)
      | undefined;
    const cancelIdle = Reflect.get(window, "cancelIdleCallback") as
      | ((handle: number) => void)
      | undefined;

    if (requestIdle !== undefined) {
      const idleId = requestIdle(activate, { timeout: 900 });
      return () => cancelIdle?.(idleId);
    }

    const timeoutId = setTimeout(activate, 500);
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div className={styles.shell} data-scene-state={sceneState}>
      <SceneFallback activeStage={activeStage} />
      {sceneState === "ready" || sceneState === "enhanced" ? (
        <Suspense fallback={null}>
          <LazyPropertyScene
            activeStage={activeStage}
            onReady={() => setSceneState((state) => (state === "ready" ? "enhanced" : state))}
          />
        </Suspense>
      ) : null}

      <div className={styles.storyControl} aria-label="Explore the Steward system story">
        <div className={styles.stageButtons}>
          {storyStages.map((stage, index) => (
            <button
              className={styles.stageButton}
              data-active={activeStage === index}
              key={stage.label}
              onClick={() => setActiveStage(index)}
              type="button"
              aria-pressed={activeStage === index}
            >
              <span className={styles.stageNumber} aria-hidden="true">
                0{index + 1}
              </span>
              {stage.label}
            </button>
          ))}
        </div>
        <p className={styles.stageDetail} aria-live="polite">
          {storyStages[activeStage]?.detail}
        </p>
      </div>

      {sceneState === "unsupported" ? (
        <p className="sr-only" role="status">
          Interactive 3D is unavailable. The complete static scene is shown instead.
        </p>
      ) : null}
    </div>
  );
}
