"use client";

import type { FormEvent } from "react";

import styles from "./guest.module.css";

export type AccessState =
  | "validating"
  | "verify-email"
  | "demo-entry"
  | "valid"
  | "expired"
  | "revoked";

interface AccessViewProps {
  state: Exclude<AccessState, "valid">;
  onContinue(): void;
}

export function AccessView({ state, onContinue }: AccessViewProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onContinue();
  };

  if (state === "validating") {
    return (
      <section className={styles.accessPanel} aria-labelledby="access-title" aria-live="polite">
        <h1 id="access-title">Checking your guest link</h1>
        <p>One moment.</p>
        <div className={styles.accessSkeleton} aria-label="Guest link validation in progress">
          <span />
          <span />
        </div>
      </section>
    );
  }

  if (state === "expired" || state === "revoked") {
    const expired = state === "expired";
    return (
      <section className={styles.accessPanel} aria-labelledby="access-title">
        <span className={`${styles.accessSymbol} ${styles.dangerSymbol}`} aria-hidden="true">
          !
        </span>
        <h1 id="access-title">This link is {expired ? "expired" : "no longer active"}</h1>
        <p>
          {expired
            ? "The booking access window has ended."
            : "The property team turned this link off."}
        </p>
        <div className={styles.safetyNote}>
          <strong>Need help?</strong>
          <span>Use the property number in your booking confirmation.</span>
        </div>
      </section>
    );
  }

  const demo = state === "demo-entry";
  return (
    <section className={styles.accessPanel} aria-labelledby="access-title">
      <h1 id="access-title">{demo ? "Try Steward as a guest" : "Confirm it’s you"}</h1>
      <p>
        {demo
          ? "Enter any email to open the demo stay."
          : "Use the email from your booking."}
      </p>
      <form className={styles.accessForm} onSubmit={handleSubmit}>
        <label htmlFor="guest-email">Booking email</label>
        <input id="guest-email" name="email" type="email" autoComplete="email" required />
        <button type="submit">{demo ? "Enter demo stay" : "Send verification link"}</button>
      </form>
      {!demo ? <p className={styles.privacyLine}>This link is limited to your stay.</p> : null}
    </section>
  );
}
