import styles from "./scene.module.css";

export function SceneFallback({ activeStage }: { activeStage: number }) {
  return (
    <figure className={styles.fallback} data-testid="scene-fallback" data-active-stage={activeStage}>
      <svg
        className={styles.staticComposition}
        viewBox="0 0 1200 760"
        role="img"
        aria-labelledby="static-scene-title static-scene-description"
      >
        <title id="static-scene-title">Steward property coordination system</title>
        <desc id="static-scene-description">
          An architectural property model links a guest signal to Steward, a responding action,
          and verified evidence.
        </desc>
        <defs>
          <filter id="soft-blue-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="16" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="soft-amber-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className={styles.lattice} aria-hidden="true">
          <path d="M120 610 556 334 1100 522 654 742Z" />
          <path d="M188 624 603 365 1038 518 619 708Z" />
          <path d="M273 640 650 395 965 514 586 671Z" />
          <path d="m231 538 445 170M342 468l443 184M466 392l442 173M609 344l419 144" />
        </g>

        <g className={styles.propertyShadow} aria-hidden="true">
          <path d="M211 542 590 316 1012 478 634 704Z" />
        </g>
        <g className={styles.propertyBase} aria-hidden="true">
          <path className={styles.baseTop} d="M208 514 588 290 1014 451 632 675Z" />
          <path className={styles.baseSide} d="m208 514 424 161v28L208 542Z" />
          <path className={styles.baseSideDark} d="m632 675 382-224v28L632 703Z" />
        </g>

        <g className={styles.roomOne} aria-hidden="true">
          <path d="M344 425 533 315 692 376 502 487Z" />
          <path d="m344 425 158 62v92l-158-61Z" />
          <path d="m502 487 190-111v92L502 579Z" />
          <path className={styles.roomEdge} d="M344 425 533 315l159 61v92L502 579l-158-61Z" />
        </g>

        <g className={styles.roomTwo} aria-hidden="true">
          <path d="M631 506 768 426 897 475 759 556Z" />
          <path d="m631 506 128 50v66l-128-49Z" />
          <path d="m759 556 138-81v67l-138 80Z" />
          <path className={styles.roomEdge} d="m631 506 137-80 129 49v67l-138 80-128-49Z" />
        </g>

        <g className={styles.frameStructure} aria-hidden="true">
          <path d="m733 337 105 40v142M733 337l111-65 105 40v142M844 272v105M733 337v142M838 377l111-65M733 479l111 42 105-67" />
          <path d="M452 410V296l162-95v116M452 296l129 50M614 201l129 49v114M581 346l162-96" />
        </g>

        <g className={`${styles.staticPath} ${styles.staticPathSignal}`} aria-hidden="true">
          <path d="M156 512c129-49 226-42 299-104 62-52 106-120 166-139" />
        </g>
        <g className={`${styles.staticPath} ${styles.staticPathAction}`} aria-hidden="true">
          <path d="M636 273c107 7 158 72 231 119 56 36 106 45 168 34" />
        </g>
        <g className={`${styles.staticPath} ${styles.staticPathEvidence}`} aria-hidden="true">
          <path d="M1032 425c-25-104-104-184-179-245" />
        </g>

        <g className={`${styles.staticNode} ${styles.staticSignal}`} aria-hidden="true">
          <circle cx="154" cy="512" r="34" />
          <circle cx="154" cy="512" r="9" filter="url(#soft-amber-glow)" />
        </g>
        <g className={`${styles.staticNode} ${styles.staticSteward}`} aria-hidden="true">
          <circle cx="622" cy="268" r="49" />
          <path d="m622 244 24 24-24 24-24-24Z" filter="url(#soft-blue-glow)" />
        </g>
        <g className={`${styles.staticNode} ${styles.staticAction}`} aria-hidden="true">
          <rect x="1016" y="410" width="31" height="31" rx="4" />
          <path d="M992 426h24m31 0h24" />
        </g>
        <g className={`${styles.staticNode} ${styles.staticEvidence}`} aria-hidden="true">
          <circle cx="852" cy="180" r="31" />
          <path d="m837 181 10 10 20-24" />
        </g>

        <g className={styles.staticLabels} aria-hidden="true">
          <text x="105" y="570">Guest signal</text>
          <text x="578" y="207">Steward</text>
          <text x="994" y="479">Action</text>
          <text x="816" y="125">Evidence</text>
        </g>
      </svg>
      <figcaption className="sr-only">
        An architectural property links a guest signal to Steward, an external action, and verified
        evidence.
      </figcaption>
    </figure>
  );
}
