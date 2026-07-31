"use client";

import { guestFixtureNames } from "../../lib/guest-presentations";
import type { AccessState } from "./access-view";
import styles from "./guest.module.css";

const accessStates: AccessState[] = [
  "validating",
  "verify-email",
  "demo-entry",
  "valid",
  "expired",
  "revoked",
];

interface DevelopmentSwitcherProps {
  access: AccessState;
  fixture: string;
  frameIndex: number;
  frameCount: number;
  onAdvance(): void;
}

export function DevelopmentSwitcher({
  access,
  fixture,
  frameIndex,
  frameCount,
  onAdvance,
}: DevelopmentSwitcherProps) {
  if (process.env.NODE_ENV !== "development") return null;

  const navigate = (next: { access?: string; fixture?: string }) => {
    const url = new URL(window.location.href);
    if (next.access !== undefined) url.searchParams.set("access", next.access);
    if (next.fixture !== undefined) {
      url.searchParams.set("fixture", next.fixture);
      url.searchParams.delete("frame");
    }
    window.location.assign(url);
  };

  return (
    <aside className={styles.devSwitcher} aria-label="Development fixture switcher">
      <details>
        <summary>Demo states</summary>
        <div className={styles.devControls}>
          <strong>Development states</strong>
          <label>
            Access
            <select value={access} onChange={(event) => navigate({ access: event.target.value })}>
              {accessStates.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>
          <label>
            Scenario
            <select value={fixture} onChange={(event) => navigate({ fixture: event.target.value })}>
              {guestFixtureNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={onAdvance} disabled={frameIndex >= frameCount - 1}>
            Next event {frameIndex + 1}/{frameCount}
          </button>
        </div>
      </details>
    </aside>
  );
}
