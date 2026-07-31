"use client";

import { Line, MeshReflectorMaterial, RoundedBox } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useReducedMotion } from "motion/react";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  MathUtils,
  Object3D,
  Vector3,
} from "three";
import type { Group, InstancedMesh, Mesh, MeshBasicMaterial, PointLight } from "three";

import styles from "./scene.module.css";

type Point3 = [number, number, number];

/** Warm = an open guest problem. Cool = Steward and verified closure. */
const INK = "#0b0807";
const STRUCTURE = "#3a211b";
const EMBER = "#e66b45";
const EMBER_PALE = "#f7dfca";
const AMBER = "#ffab3d";
const AMBER_PALE = "#ffd9a0";

const WINDOW_DARK = new Color("#1d1210");
const WINDOW_DIM = new Color("#a94c35");
const WINDOW_COOL = new Color("#f5b68e");
const WINDOW_WARM = new Color("#c98b45");

interface BuildingSpec {
  /** Footprint centre on the ground plane. */
  pos: [number, number];
  /** Width, height, depth. */
  size: Point3;
}

/** The building whose window carries the incident. */
const HERO: BuildingSpec = { pos: [-1.35, 0.35], size: [1.95, 3.15, 1.75] };

const BUILDINGS: BuildingSpec[] = [
  HERO,
  { pos: [0.95, -1.45], size: [1.5, 4.55, 1.45] },
  { pos: [1.55, 1.05], size: [2.1, 1.75, 1.6] },
  { pos: [-3.25, -0.95], size: [1.2, 2.5, 1.2] },
  { pos: [-3.05, 1.35], size: [1.45, 1.15, 1.3] },
  { pos: [3.15, -0.35], size: [1.25, 2.15, 1.15] },
];
const HERO_WINDOW: Point3 = [HERO.pos[0] + 0.42, 2.12, HERO.pos[1] + HERO.size[2] / 2 + 0.03];
const NODE: Point3 = [-0.15, 4.85, 1.25];
const VENDOR: Point3 = [3.7, 0.42, 1.75];

const signalPath: Point3[] = [
  HERO_WINDOW,
  [HERO_WINDOW[0] + 0.35, 2.85, HERO_WINDOW[2] + 0.35],
  [-0.15, 3.6, 0.95],
  NODE,
];

const actionPath: Point3[] = [
  NODE,
  [1.5, 3.65, 1.15],
  [2.85, 2.15, 1.6],
  [VENDOR[0], VENDOR[1] + 0.55, VENDOR[2]],
];

const evidencePath: Point3[] = [
  [VENDOR[0], VENDOR[1] + 0.55, VENDOR[2]],
  [2.6, 1.7, 2.35],
  [0.85, 1.6, 2.4],
  [HERO_WINDOW[0] + 0.05, HERO_WINDOW[1] - 0.15, HERO_WINDOW[2] + 0.25],
];

const stagePose = [
  { x: -0.03, y: 0.16 },
  { x: -0.05, y: 0.05 },
  { x: -0.04, y: -0.09 },
  { x: -0.02, y: 0.02 },
] as const;

function seeded(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

/** Radial falloff used for additive glows and the ground light pool. */
function makeGlowTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  if (context !== null) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.18, "rgba(255,255,255,0.55)");
    gradient.addColorStop(0.45, "rgba(255,255,255,0.16)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }

  return new CanvasTexture(canvas);
}

/** Faint site grid so the massing sits on a plane instead of floating in black. */
function makeGridTexture(): CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  if (context !== null) {
    const step = size / 24;
    context.strokeStyle = "rgba(120, 196, 236, 0.5)";
    context.lineWidth = 1;
    context.beginPath();
    for (let i = 0; i <= 24; i += 1) {
      context.moveTo(i * step, 0);
      context.lineTo(i * step, size);
      context.moveTo(0, i * step);
      context.lineTo(size, i * step);
    }
    context.stroke();

    // Fade the grid out towards the horizon so it never reads as a hard edge.
    const mask = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    mask.addColorStop(0, "rgba(0,0,0,1)");
    mask.addColorStop(0.45, "rgba(0,0,0,0.5)");
    mask.addColorStop(1, "rgba(0,0,0,0)");
    context.globalCompositeOperation = "destination-in";
    context.fillStyle = mask;
    context.fillRect(0, 0, size, size);
  }

  return new CanvasTexture(canvas);
}

function Glow({
  position,
  color,
  scale,
  opacity,
  texture,
}: {
  position: Point3;
  color: string;
  scale: number;
  opacity: number;
  texture: CanvasTexture;
}) {
  return (
    <sprite position={position} scale={[scale, scale, scale]}>
      <spriteMaterial
        map={texture}
        color={color}
        transparent
        opacity={opacity}
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  );
}

/**
 * Every facade window in one instanced draw call. Colours are seeded so the
 * composition is identical across renders and visual baselines.
 */
function Facades() {
  const mesh = useRef<InstancedMesh>(null);

  const cells = useMemo(() => {
    const random = seeded(20260731);
    const result: { p: Point3; ry: number; tone: number }[] = [];

    for (const building of BUILDINGS) {
      const [width, height, depth] = building.size;
      const columns = Math.max(2, Math.round(width / 0.46));
      const rows = Math.max(3, Math.round(height / 0.5));

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const offsetX = -width / 2 + ((column + 0.5) * width) / columns;
          const offsetY = ((row + 0.65) * height) / rows;

          result.push({
            p: [building.pos[0] + offsetX, offsetY, building.pos[1] + depth / 2 + 0.012],
            ry: 0,
            tone: random(),
          });
          result.push({
            p: [building.pos[0] + width / 2 + 0.012, offsetY, building.pos[1] + offsetX],
            ry: Math.PI / 2,
            tone: random(),
          });
        }
      }
    }

    return result;
  }, []);

  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (instanced === null) return;

    const dummy = new Object3D();

    cells.forEach((cell, index) => {
      dummy.position.set(cell.p[0], cell.p[1], cell.p[2]);
      dummy.rotation.set(0, cell.ry, 0);
      dummy.scale.set(0.19, 0.26, 1);
      dummy.updateMatrix();
      instanced.setMatrixAt(index, dummy.matrix);

      const tone =
        cell.tone < 0.52
          ? WINDOW_DARK
          : cell.tone < 0.84
            ? WINDOW_DIM
            : cell.tone < 0.95
              ? WINDOW_COOL
              : WINDOW_WARM;
      instanced.setColorAt(index, tone);
    });

    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor !== null) instanced.instanceColor.needsUpdate = true;
  }, [cells]);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, cells.length]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

function Massing() {
  return (
    <group>
      {BUILDINGS.map((building) => (
        <RoundedBox
          key={`${building.pos[0]}-${building.pos[1]}`}
          args={building.size}
          radius={0.045}
          smoothness={2}
          position={[building.pos[0], building.size[1] / 2, building.pos[1]]}
        >
          <meshStandardMaterial color={STRUCTURE} roughness={0.52} metalness={0.22} />
        </RoundedBox>
      ))}
    </group>
  );
}

/** Voice ripples leaving the property — the call itself, not fake progress. */
function VoiceRipples({
  color,
  active,
  reducedMotion,
}: {
  color: string;
  active: boolean;
  reducedMotion: boolean;
}) {
  const rings = useRef<Mesh[]>([]);
  const count = 3;

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const time = clock.elapsedTime;

    rings.current.forEach((ring, index) => {
      if (ring === undefined || ring === null) return;
      const progress = (time * 0.3 + index / count) % 1;
      const scale = 0.3 + progress * 1.5;
      ring.scale.set(scale, scale, scale);
      const material = ring.material as MeshBasicMaterial;
      material.opacity = (1 - progress) ** 1.4 * (active ? 1 : 0.3);
    });
  });

  return (
    <group position={[HERO_WINDOW[0], HERO_WINDOW[1], HERO_WINDOW[2] + 0.04]}>
      {Array.from({ length: count }, (_, index) => {
        const staticProgress = (index + 1) / (count + 1);
        const staticScale = 0.3 + staticProgress * 1.5;
        return (
          <mesh
            key={index}
            ref={(instance) => {
              if (instance !== null) rings.current[index] = instance;
            }}
            scale={reducedMotion ? staticScale : 0.45}
          >
            <ringGeometry args={[0.945, 0.965, 96]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={reducedMotion ? (1 - staticProgress) * (active ? 0.85 : 0.25) : 0}
              blending={AdditiveBlending}
              depthWrite={false}
              side={DoubleSide}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/** Steward: an aperture that holds the incident context between stages. */
function CoordinationNode({
  active,
  reducedMotion,
  texture,
}: {
  active: boolean;
  reducedMotion: boolean;
  texture: CanvasTexture;
}) {
  const outer = useRef<Mesh>(null);
  const inner = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const time = clock.elapsedTime;
    const rate = active ? 1 : 0.28;
    if (outer.current !== null) outer.current.rotation.z = time * 0.35 * rate;
    if (inner.current !== null) inner.current.rotation.z = -time * 0.52 * rate;
  });

  return (
    <group position={NODE} rotation={[0.22, -0.32, 0]}>
      <mesh ref={outer}>
        <torusGeometry args={[0.62, 0.012, 8, 96]} />
        <meshBasicMaterial
          color={EMBER}
          transparent
          opacity={active ? 0.95 : 0.4}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={inner} rotation={[0, 0, 0.6]}>
        <torusGeometry args={[0.44, 0.018, 8, 80, Math.PI * 1.45]} />
        <meshBasicMaterial
          color={EMBER_PALE}
          transparent
          opacity={active ? 0.9 : 0.32}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.085, 20, 20]} />
        <meshBasicMaterial color={EMBER_PALE} toneMapped={false} />
      </mesh>
      <Glow
        position={[0, 0, 0]}
        color={EMBER}
        scale={active ? 3.4 : 1.9}
        opacity={active ? 0.62 : 0.28}
        texture={texture}
      />
    </group>
  );
}

/** The approved vendor or tool that receives the work. */
function VendorMarker({
  active,
  reducedMotion,
  texture,
}: {
  active: boolean;
  reducedMotion: boolean;
  texture: CanvasTexture;
}) {
  const beacon = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (reducedMotion || beacon.current === null) return;
    const pulse = active ? 1 + Math.sin(clock.elapsedTime * 2.6) * 0.18 : 1;
    beacon.current.scale.setScalar(pulse);
  });

  return (
    <group position={[VENDOR[0], 0, VENDOR[2]]}>
      <RoundedBox args={[1.05, 0.4, 0.85]} radius={0.05} smoothness={2} position={[0, 0.2, 0]}>
        <meshStandardMaterial color="#2a1713" roughness={0.5} metalness={0.55} />
      </RoundedBox>
      <mesh position={[0, 0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.335, 48]} />
        <meshBasicMaterial
          color={active ? EMBER_PALE : EMBER}
          transparent
          opacity={active ? 0.9 : 0.3}
          side={DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={beacon} position={[0, 0.62, 0]}>
        <sphereGeometry args={[0.075, 18, 18]} />
        <meshBasicMaterial color={active ? EMBER_PALE : EMBER} toneMapped={false} />
      </mesh>
      <Glow
        position={[0, 0.62, 0]}
        color={EMBER}
        scale={active ? 2.2 : 1.1}
        opacity={active ? 0.55 : 0.2}
        texture={texture}
      />
    </group>
  );
}

function Thread({
  points,
  color,
  active,
}: {
  points: Point3[];
  color: string;
  active: boolean;
}) {
  const curve = useMemo(
    () => new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, y, z))),
    [points],
  );
  const resolved = useMemo(() => curve.getPoints(64).map((p) => [p.x, p.y, p.z] as Point3), [curve]);

  return (
    <>
      <Line
        points={resolved}
        color={color}
        transparent
        opacity={active ? 0.92 : 0.07}
        lineWidth={active ? 1.7 : 0.5}
      />
      {active ? (
        <Line points={resolved} color={color} transparent opacity={0.14} lineWidth={7} />
      ) : null}
    </>
  );
}

function TravellingPulse({
  points,
  color,
  active,
  reducedMotion,
  texture,
  offset,
}: {
  points: Point3[];
  color: string;
  active: boolean;
  reducedMotion: boolean;
  texture: CanvasTexture;
  offset: number;
}) {
  const group = useRef<Group>(null);
  const curve = useMemo(
    () => new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, y, z))),
    [points],
  );

  useFrame(({ clock }) => {
    if (reducedMotion || group.current === null || !active) return;
    const progress = (clock.elapsedTime * 0.34 + offset) % 1;
    const point = curve.getPoint(progress);
    group.current.position.copy(point);
  });

  const start = curve.getPoint(reducedMotion ? 0.5 : offset % 1);

  if (!active) return null;

  return (
    <group ref={group} position={[start.x, start.y, start.z]}>
      <mesh>
        <sphereGeometry args={[0.052, 16, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <Glow position={[0, 0, 0]} color={color} scale={1.05} opacity={0.75} texture={texture} />
    </group>
  );
}

function PropertyModel({
  activeStage,
  reducedMotion,
}: {
  activeStage: number;
  reducedMotion: boolean;
}) {
  const group = useRef<Group>(null);
  const heroLight = useRef<PointLight>(null);
  const compact = useThree((state) => state.size.width < 640);
  const pose = stagePose[activeStage] ?? stagePose[0];
  const texture = useMemo(makeGlowTexture, []);
  const gridTexture = useMemo(makeGridTexture, []);

  /** The incident stays warm until evidence closes it. */
  const verified = activeStage === 3;
  const incidentColor = verified ? EMBER_PALE : AMBER;
  const incidentPale = verified ? EMBER_PALE : AMBER_PALE;

  useFrame(({ pointer, clock }, delta) => {
    if (reducedMotion) return;

    if (group.current !== null) {
      const targetX = pose.x + pointer.y * 0.045;
      const targetY = pose.y + pointer.x * 0.09;
      const smoothing = Math.min(delta * 2.4, 1);
      group.current.rotation.x = MathUtils.lerp(group.current.rotation.x, targetX, smoothing);
      group.current.rotation.y = MathUtils.lerp(group.current.rotation.y, targetY, smoothing);
    }

    if (heroLight.current !== null) {
      const breathe = 1 + Math.sin(clock.elapsedTime * 1.9) * 0.14;
      heroLight.current.intensity = (activeStage === 0 ? 16 : 9) * breathe;
    }
  });

  return (
    <group
      ref={group}
      rotation={[pose.x, pose.y, 0]}
      position={compact ? [0.2, 0.75, 0] : [0.75, -1.35, 0]}
      scale={compact ? 0.52 : 0.95}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[46, 46]} />
        <MeshReflectorMaterial
          resolution={256}
          blur={[420, 120]}
          mixBlur={1.1}
          mixStrength={2.6}
          depthScale={1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.25}
          color="#0b0807"
          metalness={0.7}
          roughness={0.78}
          mirror={0.72}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <planeGeometry args={[26, 26]} />
        <meshBasicMaterial
          map={gridTexture}
          transparent
          opacity={0.15}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <Massing />
      <Facades />

      {/* Warm pool of light the incident casts on the ground. */}
      <sprite
        position={[HERO.pos[0], 0.03, HERO.pos[1] + 0.6]}
        scale={[6.2, 6.2, 6.2]}
        rotation={[0, 0, 0]}
      >
        <spriteMaterial
          map={texture}
          color={incidentColor}
          transparent
          opacity={activeStage === 0 ? 0.34 : 0.2}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>

      <VoiceRipples
        color={incidentColor}
        active={activeStage === 0}
        reducedMotion={reducedMotion}
      />

      {/* The lit window: one guest, one open problem. */}
      <mesh position={HERO_WINDOW}>
        <planeGeometry args={[0.24, 0.34]} />
        <meshBasicMaterial color={incidentPale} toneMapped={false} />
      </mesh>
      <Glow
        position={[HERO_WINDOW[0], HERO_WINDOW[1], HERO_WINDOW[2] + 0.02]}
        color={incidentColor}
        scale={activeStage === 0 ? 0.85 : 0.62}
        opacity={activeStage === 0 ? 0.95 : 0.55}
        texture={texture}
      />
      <pointLight
        ref={heroLight}
        color={incidentColor}
        intensity={12}
        distance={3.2}
        decay={2.4}
        position={[HERO_WINDOW[0], HERO_WINDOW[1], HERO_WINDOW[2] + 0.55]}
      />

      <CoordinationNode
        active={activeStage === 1}
        reducedMotion={reducedMotion}
        texture={texture}
      />
      <VendorMarker active={activeStage === 2} reducedMotion={reducedMotion} texture={texture} />

      <Thread points={signalPath} color={AMBER} active={activeStage === 0 || activeStage === 1} />
      <Thread points={actionPath} color={EMBER} active={activeStage === 2} />
      <Thread points={evidencePath} color={EMBER_PALE} active={activeStage === 3} />

      <TravellingPulse
        points={signalPath}
        color={AMBER_PALE}
        active={activeStage === 0 || activeStage === 1}
        reducedMotion={reducedMotion}
        texture={texture}
        offset={0.1}
      />
      <TravellingPulse
        points={actionPath}
        color={EMBER_PALE}
        active={activeStage === 2}
        reducedMotion={reducedMotion}
        texture={texture}
        offset={0.35}
      />
      <TravellingPulse
        points={evidencePath}
        color={EMBER_PALE}
        active={activeStage === 3}
        reducedMotion={reducedMotion}
        texture={texture}
        offset={0.6}
      />
    </group>
  );
}

export default function PropertyScene({
  activeStage,
  onReady,
}: {
  activeStage: number;
  onReady(): void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = prefersReducedMotion ?? false;

  return (
    <div className={styles.canvasWrap} aria-hidden="true" data-testid="three-scene">
      <Canvas
        camera={{ position: [0, 3.7, 12.6], fov: 39 }}
        dpr={[1, 1.5]}
        frameloop={reducedMotion ? "demand" : "always"}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        onCreated={onReady}
      >
        <fog attach="fog" args={[INK, 15, 34]} />
        <ambientLight intensity={0.22} />
        <hemisphereLight args={["#c56f52", "#090403", 1.1]} />
        {/* Cool key from upper left carves the lit face; dim fill keeps the far side readable. */}
        <directionalLight color="#f7dfca" intensity={2.6} position={[-7, 10, 7]} />
        <directionalLight color="#a94c35" intensity={0.7} position={[8, 4, -5]} />
        <PropertyModel activeStage={activeStage} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
