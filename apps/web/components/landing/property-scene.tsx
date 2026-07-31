"use client";

import { Edges, Line, RoundedBox } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useReducedMotion } from "motion/react";
import { useMemo, useRef } from "react";
import { CatmullRomCurve3, MathUtils, Vector3 } from "three";
import type { Group, Mesh } from "three";

import styles from "./scene.module.css";

type Point3 = [number, number, number];

const harbor = "#55b9e4";
const harborBright = "#bcecff";
const harborDeep = "#0f5c7f";
const amber = "#f1b94f";
const neutral = "#91a3ab";
const ink = "#091217";

const signalPath: Point3[] = [
  [-4.2, 0.05, 1.5],
  [-3.4, 0.28, 0.92],
  [-2.35, 0.4, 0.22],
  [-1.1, 1.2, -0.05],
  [0, 1.72, 0],
];

const actionPath: Point3[] = [
  [0.14, 1.66, 0],
  [1.25, 1.25, 0.08],
  [2.25, 0.58, 0.62],
  [3.64, 0.24, 0.82],
];

const evidencePath: Point3[] = [
  [3.62, 0.42, 0.82],
  [3.48, 1.1, 0.58],
  [3.08, 1.88, 0.08],
  [2.34, 2.4, -0.52],
];

const stagePose = [
  { x: -0.2, y: -0.54 },
  { x: -0.24, y: -0.42 },
  { x: -0.18, y: -0.31 },
  { x: -0.27, y: -0.23 },
] as const;

function Beam({
  position,
  scale,
  color = "#1a333e",
}: {
  position: Point3;
  scale: Point3;
  color?: string;
}) {
  return (
    <mesh position={position} scale={scale}>
      <boxGeometry />
      <meshStandardMaterial color={color} roughness={0.5} metalness={0.28} />
      <Edges color="#396170" threshold={12} />
    </mesh>
  );
}

function RoomVolume({
  position,
  size,
  color,
}: {
  position: Point3;
  size: Point3;
  color: string;
}) {
  return (
    <RoundedBox args={size} radius={0.08} smoothness={2} position={position}>
      <meshStandardMaterial color={color} roughness={0.54} metalness={0.18} />
      <Edges color="#315867" threshold={16} />
    </RoundedBox>
  );
}

function GroundLattice() {
  const rows = [-3, -2, -1, 0, 1, 2, 3];
  const columns = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];

  return (
    <group position={[0, -1.13, 0]}>
      {rows.map((z) => (
        <Line
          key={`row-${z}`}
          points={[
            [-6.1, 0, z],
            [6.1, 0, z],
          ]}
          color="#2b4b58"
          transparent
          opacity={0.24}
          lineWidth={0.55}
        />
      ))}
      {columns.map((x) => (
        <Line
          key={`column-${x}`}
          points={[
            [x, 0, -3.5],
            [x, 0, 3.5],
          ]}
          color="#2b4b58"
          transparent
          opacity={0.2}
          lineWidth={0.55}
        />
      ))}
    </group>
  );
}

function SignalPulse({
  path,
  color,
  offset,
  active,
  reducedMotion,
}: {
  path: Point3[];
  color: string;
  offset: number;
  active: boolean;
  reducedMotion: boolean;
}) {
  const pulse = useRef<Mesh>(null);
  const curve = useMemo(
    () => new CatmullRomCurve3(path.map(([x, y, z]) => new Vector3(x, y, z))),
    [path],
  );

  useFrame(({ clock }) => {
    if (pulse.current === null || reducedMotion) return;
    const progress = (clock.elapsedTime * 0.12 + offset) % 1;
    pulse.current.position.copy(curve.getPoint(progress));
  });

  const fixedPosition = curve.getPoint(offset % 1);

  return (
    <mesh ref={pulse} position={fixedPosition} scale={active ? 1 : 0.62}>
      <sphereGeometry args={[0.075, 14, 14]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={active ? 4.5 : 1.2}
      />
    </mesh>
  );
}

function Pathway({
  points,
  color,
  active,
}: {
  points: Point3[];
  color: string;
  active: boolean;
}) {
  return (
    <>
      <Line
        points={points}
        color={color}
        transparent
        opacity={active ? 0.95 : 0.2}
        lineWidth={active ? 1.7 : 0.8}
      />
      <Line points={points} color={color} transparent opacity={active ? 0.16 : 0.04} lineWidth={8} />
    </>
  );
}

function PropertyModel({ activeStage, reducedMotion }: { activeStage: number; reducedMotion: boolean }) {
  const group = useRef<Group>(null);
  const compact = useThree((state) => state.size.width < 640);
  const pose = stagePose[activeStage] ?? stagePose[0];

  useFrame(({ pointer }, delta) => {
    if (reducedMotion || group.current === null) return;
    const targetX = pose.x + pointer.y * 0.055;
    const targetY = pose.y + pointer.x * 0.07;
    const smoothing = Math.min(delta * 2.2, 1);
    group.current.rotation.x = MathUtils.lerp(group.current.rotation.x, targetX, smoothing);
    group.current.rotation.y = MathUtils.lerp(group.current.rotation.y, targetY, smoothing);
  });

  return (
    <group
      ref={group}
      rotation={[pose.x, pose.y, 0]}
      position={compact ? [0.4, 1.42, 0] : [0.85, -0.05, 0]}
      scale={compact ? 0.63 : 0.9}
    >
      <GroundLattice />

      <RoundedBox args={[7.5, 0.24, 4.7]} radius={0.1} smoothness={2} position={[0, -1, 0]}>
        <meshStandardMaterial color="#0c181e" roughness={0.7} metalness={0.22} />
        <Edges color="#244553" threshold={14} />
      </RoundedBox>

      <RoomVolume position={[-1.95, -0.2, -0.55]} size={[2.5, 1.36, 2.4]} color="#142b34" />
      <RoomVolume position={[1.25, -0.38, 0.78]} size={[2.05, 1, 1.9]} color="#10262f" />
      <RoomVolume position={[2.23, -0.08, -0.98]} size={[1.62, 1.58, 1.4]} color="#17313b" />

      <Beam position={[-3.38, -0.04, -1.35]} scale={[0.08, 1.02, 0.08]} />
      <Beam position={[-0.58, -0.04, -1.35]} scale={[0.08, 1.02, 0.08]} />
      <Beam position={[-1.98, 0.96, -1.35]} scale={[1.48, 0.08, 0.08]} />
      <Beam position={[-1.98, 0.96, 0.24]} scale={[1.48, 0.08, 0.08]} />
      <Beam position={[-3.38, 0.96, -0.55]} scale={[0.08, 0.08, 0.87]} />

      <Beam position={[0.32, 0.16, -1.7]} scale={[0.07, 1.12, 0.07]} color="#1d3e4a" />
      <Beam position={[0.32, 1.27, -0.6]} scale={[0.07, 0.07, 1.15]} color="#1d3e4a" />
      <Beam position={[0.32, 0.16, 0.52]} scale={[0.07, 1.12, 0.07]} color="#1d3e4a" />

      <mesh position={[-4.2, 0.05, 1.5]}>
        <sphereGeometry args={[0.17, 22, 22]} />
        <meshStandardMaterial
          color={amber}
          emissive={amber}
          emissiveIntensity={activeStage === 0 ? 5 : 1.8}
        />
      </mesh>
      <mesh position={[-4.2, 0.05, 1.5]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.34, 0.018, 10, 42]} />
        <meshBasicMaterial color={amber} transparent opacity={activeStage === 0 ? 0.9 : 0.25} />
      </mesh>

      <group position={[0, 1.72, 0]} rotation={[0.1, 0.12, 0]}>
        <mesh>
          <octahedronGeometry args={[0.36, 0]} />
          <meshStandardMaterial
            color={harbor}
            emissive={harborDeep}
            emissiveIntensity={activeStage === 1 ? 5 : 2.2}
            metalness={0.32}
            roughness={0.3}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.62, 0.018, 10, 48]} />
          <meshBasicMaterial color={harbor} transparent opacity={activeStage === 1 ? 0.86 : 0.18} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.83, 0.012, 10, 52]} />
          <meshBasicMaterial color={harborBright} transparent opacity={activeStage === 1 ? 0.42 : 0.08} />
        </mesh>
      </group>

      <group position={[3.64, 0.24, 0.82]} rotation={[0.12, -0.18, 0.08]}>
        <mesh>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial
            color={neutral}
            emissive="#39515a"
            emissiveIntensity={activeStage === 2 ? 2.8 : 0.45}
            metalness={0.55}
            roughness={0.3}
          />
          <Edges color={activeStage === 2 ? harborBright : "#9babb2"} />
        </mesh>
        <Beam position={[-0.48, 0, 0]} scale={[0.26, 0.04, 0.04]} color="#607681" />
        <Beam position={[0.48, 0, 0]} scale={[0.26, 0.04, 0.04]} color="#607681" />
      </group>

      <group position={[2.34, 2.4, -0.52]} rotation={[0.1, 0.3, 0]}>
        <mesh>
          <torusGeometry args={[0.42, 0.055, 14, 48]} />
          <meshStandardMaterial
            color={harbor}
            emissive={harborDeep}
            emissiveIntensity={activeStage === 3 ? 4.2 : 1.3}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color={harborBright} emissive={harbor} emissiveIntensity={3.2} />
        </mesh>
        <Line
          points={[
            [-0.2, 0, 0.02],
            [-0.04, -0.16, 0.02],
            [0.24, 0.2, 0.02],
          ]}
          color={harborBright}
          lineWidth={2.2}
          transparent
          opacity={activeStage === 3 ? 1 : 0.45}
        />
      </group>

      <Pathway points={signalPath} color={amber} active={activeStage === 0} />
      <Pathway points={actionPath} color={harbor} active={activeStage === 1 || activeStage === 2} />
      <Pathway points={evidencePath} color={neutral} active={activeStage === 3} />

      <SignalPulse
        path={signalPath}
        color={amber}
        offset={0.08}
        active={activeStage === 0}
        reducedMotion={reducedMotion}
      />
      <SignalPulse
        path={actionPath}
        color={harborBright}
        offset={0.38}
        active={activeStage === 1 || activeStage === 2}
        reducedMotion={reducedMotion}
      />
      <SignalPulse
        path={evidencePath}
        color={neutral}
        offset={0.68}
        active={activeStage === 3}
        reducedMotion={reducedMotion}
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
        camera={{ position: [0, 2.45, 10.7], fov: 39 }}
        dpr={[1, 1.5]}
        frameloop={reducedMotion ? "demand" : "always"}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        onCreated={onReady}
      >
        <fog attach="fog" args={[ink, 10, 19]} />
        <ambientLight intensity={0.64} />
        <hemisphereLight args={["#a7e2fa", "#081015", 1.5]} />
        <directionalLight color="#d9f4ff" intensity={2.8} position={[2, 7, 6]} />
        <pointLight color={amber} intensity={20} distance={5.5} position={[-4.1, 0.5, 2]} />
        <pointLight color={harbor} intensity={22} distance={7} position={[0, 2.4, 1]} />
        <pointLight color={harbor} intensity={10} distance={5} position={[3.2, 2.2, 0]} />
        <PropertyModel activeStage={activeStage} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
