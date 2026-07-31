"use client";

import { lazy, Suspense, useEffect, useState } from "react";

import { SceneFallback } from "./scene-fallback";
import styles from "./scene.module.css";

const LazyPropertyScene = lazy(async () => import("./property-scene"));

type SceneState = "waiting" | "ready" | "unsupported";

function supportsWebGl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function SceneShell() {
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
      <SceneFallback />
      {sceneState === "ready" ? (
        <Suspense fallback={null}>
          <LazyPropertyScene />
        </Suspense>
      ) : null}
      {sceneState === "unsupported" ? (
        <p className="sr-only" role="status">
          Interactive 3D is unavailable. The complete static scene is shown instead.
        </p>
      ) : null}
    </div>
  );
}
