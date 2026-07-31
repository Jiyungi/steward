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
        <p className={styles.contextLabel}>Temporary guest access</p>
        <h1 id="access-title">Checking your guest link</h1>
        <p>Steward is confirming the link’s booking scope and access window.</p>
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
        <p className={styles.contextLabel}>Temporary guest access</p>
        <h1 id="access-title">This link is {expired ? "expired" : "no longer active"}</h1>
        <p>
          {expired
            ? "The booking access window has ended, so this link cannot reveal incident details."
            : "The property team revoked this link, so it can no longer open the guest incident."}
        </p>
        <div className={styles.safetyNote}>
          <strong>Your information remains protected.</strong>
          <span>Contact the property using the number in your booking confirmation for a new path.</span>
        </div>
      </section>
    );
  }

  const demo = state === "demo-entry";
  return (
    <section className={styles.accessPanel} aria-labelledby="access-title">
      <p className={styles.contextLabel}>{demo ? "Demo guest entry" : "Email verification required"}</p>
      <h1 id="access-title">{demo ? "Try Steward as a guest" : "Confirm it’s you"}</h1>
      <p>
        {demo
          ? "Use an email to enter a seeded, temporary demo stay. No permanent Guest account is created."
          : "Use the email associated with this booking before Steward shows property-specific details."}
      </p>
      <form className={styles.accessForm} onSubmit={handleSubmit}>
        <label htmlFor="guest-email">Booking email</label>
        <input id="guest-email" name="email" type="email" autoComplete="email" required />
        <button type="submit">{demo ? "Enter demo stay" : "Send verification link"}</button>
      </form>
      <p className={styles.privacyLine}>
        {demo
          ? "Fixture mode uses no live booking or provider services."
          : "The link remains limited to this booking and its active incident."}
      </p>
    </section>
  );
}
