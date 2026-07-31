import styles from "./scene.module.css";

interface Block {
  x: number;
  y: number;
  width: number;
  height: number;
}

const GROUND = 622;

/** Elevation of the same massing the 3D scene renders. */
const BLOCKS: Block[] = [
  { x: 108, y: 386, width: 116, height: GROUND - 386 },
  { x: 234, y: 506, width: 132, height: GROUND - 506 },
  { x: 330, y: 320, width: 186, height: GROUND - 320 },
  { x: 530, y: 190, width: 150, height: GROUND - 190 },
  { x: 694, y: 450, width: 206, height: GROUND - 450 },
  { x: 914, y: 414, width: 120, height: GROUND - 414 },
];

/** The block whose window carries the incident. */
const HERO = BLOCKS[2] as Block;
const HERO_WINDOW = { x: HERO.x + 96, y: HERO.y + 104, width: 22, height: 30 };
const NODE = { x: 604, y: 122 };
const VENDOR = { x: 1096, y: 600 };

function seeded(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

/** Deterministic so server and client markup agree and baselines stay stable. */
function buildWindows() {
  const random = seeded(20260731);
  const cells: { key: string; x: number; y: number; tone: string }[] = [];

  BLOCKS.forEach((block, blockIndex) => {
    const columns = Math.max(2, Math.round(block.width / 44));
    const rows = Math.max(2, Math.round(block.height / 48));
    const cellWidth = block.width / columns;
    const cellHeight = block.height / rows;

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const draw = random();
        const tone =
          draw < 0.52 ? "dark" : draw < 0.84 ? "dim" : draw < 0.95 ? "cool" : "warm";

        cells.push({
          key: `${blockIndex}-${row}-${column}`,
          x: block.x + column * cellWidth + (cellWidth - 22) / 2,
          y: block.y + row * cellHeight + (cellHeight - 30) / 2,
          tone,
        });
      }
    }
  });

  return cells;
}

const WINDOWS = buildWindows();

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
          A property at night with one lit window carrying a guest incident, a signal path to
          Steward, an action reaching a vendor, and verified evidence returning to the guest.
        </desc>
        <defs>
          <filter id="soft-blue-glow" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="14" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="soft-amber-glow" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="11" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="ground-fade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3a211b" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0b0807" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g className={styles.lattice} aria-hidden="true">
          <path d="M60 622h1080M150 664h900M250 706h700" />
        </g>
        <rect
          x="60"
          y={GROUND}
          width="1080"
          height="120"
          fill="url(#ground-fade)"
          aria-hidden="true"
        />

        <g className={styles.massing} aria-hidden="true">
          {BLOCKS.map((block) => (
            <rect
              key={`${block.x}-${block.y}`}
              x={block.x}
              y={block.y}
              width={block.width}
              height={block.height}
              rx="3"
            />
          ))}
        </g>

        <g aria-hidden="true">
          {WINDOWS.map((cell) => (
            <rect
              className={styles[`window${cell.tone}` as keyof typeof styles]}
              height="30"
              key={cell.key}
              rx="1.5"
              width="22"
              x={cell.x}
              y={cell.y}
            />
          ))}
        </g>

        <g className={`${styles.staticPath} ${styles.staticPathSignal}`} aria-hidden="true">
          <path d={`M${HERO_WINDOW.x + 11} ${HERO_WINDOW.y} C 470 330 540 250 ${NODE.x} ${NODE.y + 46}`} />
        </g>
        <g className={`${styles.staticPath} ${styles.staticPathAction}`} aria-hidden="true">
          <path d={`M${NODE.x + 46} ${NODE.y + 14} C 820 170 1060 340 ${VENDOR.x} ${VENDOR.y - 24}`} />
        </g>
        <g className={`${styles.staticPath} ${styles.staticPathEvidence}`} aria-hidden="true">
          <path
            d={`M${VENDOR.x - 28} ${VENDOR.y + 6} C 900 712 560 712 ${HERO_WINDOW.x + 22} ${HERO_WINDOW.y + 26}`}
          />
        </g>

        {/* The incident window stays warm until evidence closes it. */}
        <g
          className={`${styles.staticNode} ${activeStage === 3 ? styles.staticVerified : styles.staticSignal}`}
          aria-hidden="true"
        >
          <circle
            className={styles.voiceRing}
            cx={HERO_WINDOW.x + 11}
            cy={HERO_WINDOW.y + 15}
            r="42"
          />
          <circle
            className={styles.voiceRing}
            cx={HERO_WINDOW.x + 11}
            cy={HERO_WINDOW.y + 15}
            r="72"
          />
          <rect
            filter="url(#soft-amber-glow)"
            height={HERO_WINDOW.height}
            rx="2"
            width={HERO_WINDOW.width}
            x={HERO_WINDOW.x}
            y={HERO_WINDOW.y}
          />
        </g>

        <g className={`${styles.staticNode} ${styles.staticSteward}`} aria-hidden="true">
          <circle cx={NODE.x} cy={NODE.y} r="46" />
          <path d={`M${NODE.x - 32} ${NODE.y} a32 32 0 0 1 44 -30`} />
          <circle
            className={styles.nodeCore}
            cx={NODE.x}
            cy={NODE.y}
            filter="url(#soft-blue-glow)"
            r="7"
          />
        </g>

        <g className={`${styles.staticNode} ${styles.staticAction}`} aria-hidden="true">
          <rect height="26" rx="3" width="66" x={VENDOR.x - 33} y={VENDOR.y} />
          <ellipse cx={VENDOR.x} cy={VENDOR.y} rx="26" ry="8" />
          <circle
            className={styles.nodeCore}
            cx={VENDOR.x}
            cy={VENDOR.y - 16}
            filter="url(#soft-blue-glow)"
            r="6"
          />
        </g>
      </svg>
      <figcaption className="sr-only">
        A property at night. One lit window carries a guest incident to Steward, which routes the
        action to a vendor and returns verified evidence to the guest.
      </figcaption>
    </figure>
  );
}
