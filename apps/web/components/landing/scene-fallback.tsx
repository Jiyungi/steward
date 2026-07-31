import styles from "./scene.module.css";

export function SceneFallback() {
  return (
    <figure className={styles.fallback} data-testid="scene-fallback">
      <div className={styles.staticComposition} aria-hidden="true">
        <span className={styles.propertyPlane} />
        <span className={styles.propertyVolumeOne} />
        <span className={styles.propertyVolumeTwo} />
        <span className={styles.signalNode} />
        <span className={styles.stewardNode} />
        <span className={styles.actionNode} />
        <span className={styles.evidenceNode} />
        <span className={`${styles.trace} ${styles.traceOne}`} />
        <span className={`${styles.trace} ${styles.traceTwo}`} />
        <span className={`${styles.trace} ${styles.traceThree}`} />
      </div>
      <figcaption className="sr-only">
        An abstract property links a guest signal to Steward, an external action, and verified
        evidence.
      </figcaption>
    </figure>
  );
}
