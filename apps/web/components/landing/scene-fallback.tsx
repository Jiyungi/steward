import styles from "./scene.module.css";

export function SceneFallback({ activeStage }: { activeStage: number }) {
  void activeStage;

  return (
    <figure className={styles.fallback} data-testid="scene-fallback">
      <svg
        className={styles.staticComposition}
        viewBox="0 0 900 700"
        role="img"
        aria-labelledby="static-scene-title static-scene-description"
      >
        <title id="static-scene-title">A sunlit Steward property</title>
        <desc id="static-scene-description">
          A modern rental home, trees, a walkway, and a service van arriving at the front door.
        </desc>

        <path className={styles.staticGround} d="M90 496 470 300l344 168-381 204Z" />
        <path className={styles.staticDrive} d="m437 580 266-136 82 40-270 140Z" />

        <g className={styles.staticNeighbor} aria-hidden="true">
          <path d="M107 313 251 240l105 52-144 75Z" />
          <path d="M107 313v190l105 52V367Z" />
          <path d="m212 367 144-75v190l-144 73Z" />
        </g>

        <g className={styles.staticHome} aria-hidden="true">
          <path className={styles.staticRoof} d="m290 280 282-143 197 97-286 146Z" />
          <path className={styles.staticFront} d="M290 280v230l193 95V380Z" />
          <path className={styles.staticSide} d="m483 380 286-146v230L483 605Z" />
          <path className={styles.staticAccent} d="m290 280 77-39v230l-77 39Z" />
          <path className={styles.staticDoor} d="m397 457 49 24v83l-49-24Z" />
          <g className={styles.staticWindows}>
            <path d="m514 374 66-34v55l-66 33Z" />
            <path d="m604 328 66-34v55l-66 33Z" />
            <path d="m694 282 46-23v55l-46 23Z" />
            <path d="m524 467 136-69v52l-136 68Z" />
          </g>
        </g>

        <g className={styles.staticTrees} aria-hidden="true">
          <path d="M214 530v-92M736 509v-82" />
          <path d="M164 429c18-63 91-59 105-6 52 18 31 83-17 76-22 42-88 18-74-23-31-7-37-39-14-47ZM691 418c17-53 78-50 91-5 43 16 26 69-15 64-18 34-73 15-61-19-27-6-31-33-15-40Z" />
        </g>

        <g className={styles.staticVan} aria-hidden="true">
          <path d="m596 547 105-53 76 37-106 54Z" />
          <path d="m596 547v45l75 37v-44Z" />
          <path d="m671 585 106-54v44l-106 54Z" />
          <path d="m706 529 33-16 26 13-34 17Z" />
          <ellipse cx="626" cy="602" rx="12" ry="16" />
          <ellipse cx="735" cy="601" rx="12" ry="16" />
        </g>
      </svg>
      <figcaption className="sr-only">
        Steward connects a guest at a property with the help needed to resolve their issue.
      </figcaption>
    </figure>
  );
}
