"use client";

import { ContactShadows, RoundedBox } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { MathUtils } from "three";
import type { Group } from "three";

import styles from "./scene.module.css";

const COLORS = {
  chalk: "#f4efe3",
  paper: "#fffdf7",
  forest: "#284c3c",
  sage: "#879783",
  clay: "#cc7653",
  sand: "#d8cbb7",
  glass: "#6f8b83",
  path: "#d7c4a8",
  ground: "#cbd6c5",
  tire: "#28302c",
};

function Window({ position, size = [0.58, 0.72, 0.05] }: { position: [number, number, number]; size?: [number, number, number] }) {
  return (
    <group position={position}>
      <RoundedBox args={[size[0] + 0.09, size[1] + 0.09, 0.055]} radius={0.025} smoothness={2}>
        <meshStandardMaterial color={COLORS.forest} roughness={0.72} />
      </RoundedBox>
      <RoundedBox args={size} radius={0.018} smoothness={2} position={[0, 0, 0.035]}>
        <meshStandardMaterial color={COLORS.glass} roughness={0.22} metalness={0.18} />
      </RoundedBox>
      <mesh position={[0, 0, 0.072]}>
        <boxGeometry args={[0.035, size[1], 0.025]} />
        <meshStandardMaterial color={COLORS.paper} roughness={0.8} />
      </mesh>
    </group>
  );
}

function MainHome() {
  return (
    <group position={[-0.7, 0, 0.15]}>
      <RoundedBox args={[4.6, 2.75, 2.8]} radius={0.08} smoothness={3} position={[0, 1.38, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={COLORS.chalk} roughness={0.82} />
      </RoundedBox>
      <RoundedBox args={[1.48, 3.2, 2.93]} radius={0.07} smoothness={3} position={[-1.56, 1.6, 0]} castShadow>
        <meshStandardMaterial color={COLORS.forest} roughness={0.74} />
      </RoundedBox>
      <RoundedBox args={[4.88, 0.18, 3.06]} radius={0.05} smoothness={3} position={[0, 2.82, 0]} castShadow>
        <meshStandardMaterial color={COLORS.paper} roughness={0.85} />
      </RoundedBox>

      <group position={[0, 0, 1.43]}>
        <RoundedBox args={[0.9, 1.86, 0.12]} radius={0.04} smoothness={3} position={[-0.82, 0.94, 0]}>
          <meshStandardMaterial color={COLORS.clay} roughness={0.7} />
        </RoundedBox>
        <mesh position={[-0.53, 0.92, 0.08]}>
          <sphereGeometry args={[0.055, 18, 18]} />
          <meshStandardMaterial color="#e9bd66" metalness={0.55} roughness={0.3} />
        </mesh>
        <Window position={[0.58, 1.72, 0]} size={[0.92, 0.72, 0.05]} />
        <Window position={[1.64, 1.72, 0]} size={[0.7, 0.72, 0.05]} />
        <Window position={[0.83, 0.68, 0]} size={[1.55, 0.68, 0.05]} />
      </group>

      <group position={[2.31, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <Window position={[0.72, 1.72, 0]} size={[0.72, 0.72, 0.05]} />
        <Window position={[-0.48, 1.72, 0]} size={[0.72, 0.72, 0.05]} />
      </group>

      <RoundedBox args={[1.25, 0.12, 0.58]} radius={0.03} smoothness={2} position={[-0.82, 0.08, 1.72]} receiveShadow>
        <meshStandardMaterial color={COLORS.path} roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={[0.55, 0.46, 0.5]} radius={0.05} smoothness={2} position={[1.78, 0.26, 1.55]}>
        <meshStandardMaterial color={COLORS.clay} roughness={0.82} />
      </RoundedBox>
      <group position={[1.78, 0.58, 1.56]}>
        <mesh castShadow>
          <icosahedronGeometry args={[0.43, 2]} />
          <meshStandardMaterial color={COLORS.sage} roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

function Neighbor({ position, height, color }: { position: [number, number, number]; height: number; color: string }) {
  return (
    <group position={position}>
      <RoundedBox args={[2.25, height, 2.25]} radius={0.06} smoothness={2} position={[0, height / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.84} />
      </RoundedBox>
      {[0.8, 1.55, 2.3, 3.05].filter((y) => y < height - 0.3).map((y) => (
        <Window key={y} position={[0, y, 1.14]} size={[1.16, 0.42, 0.04]} />
      ))}
    </group>
  );
}

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.62, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.15, 1.25, 10]} />
        <meshStandardMaterial color="#7d624d" roughness={1} />
      </mesh>
      <mesh position={[0, 1.52, 0]} castShadow>
        <icosahedronGeometry args={[0.68, 2]} />
        <meshStandardMaterial color={COLORS.sage} roughness={0.95} />
      </mesh>
      <mesh position={[0.32, 1.38, 0.08]} castShadow>
        <icosahedronGeometry args={[0.45, 2]} />
        <meshStandardMaterial color="#768a73" roughness={0.95} />
      </mesh>
    </group>
  );
}

function ServiceVan() {
  return (
    <group position={[3.1, 0.4, 2.35]} rotation={[0, -0.34, 0]}>
      <RoundedBox args={[1.85, 0.72, 0.94]} radius={0.14} smoothness={3} castShadow>
        <meshStandardMaterial color={COLORS.paper} roughness={0.7} />
      </RoundedBox>
      <RoundedBox args={[0.72, 0.62, 0.96]} radius={0.12} smoothness={3} position={[0.78, -0.04, 0]} castShadow>
        <meshStandardMaterial color={COLORS.forest} roughness={0.72} />
      </RoundedBox>
      <mesh position={[0.94, 0.1, 0.49]}>
        <planeGeometry args={[0.43, 0.28]} />
        <meshStandardMaterial color={COLORS.glass} roughness={0.2} />
      </mesh>
      {[-0.58, 0.62].flatMap((x) => [-0.48, 0.48].map((z) => (
        <mesh key={`${x}-${z}`} position={[x, -0.4, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.1, 20]} />
          <meshStandardMaterial color={COLORS.tire} roughness={0.9} />
        </mesh>
      )))}
    </group>
  );
}

function PropertyModel({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<Group>(null);

  useFrame(({ pointer }, delta) => {
    if (group.current === null || reducedMotion) return;
    group.current.rotation.y = MathUtils.damp(group.current.rotation.y, pointer.x * 0.045, 3.6, delta);
    group.current.rotation.x = MathUtils.damp(group.current.rotation.x, -pointer.y * 0.018, 3.6, delta);
  });

  return (
    <group ref={group} rotation={[0, -0.18, 0]} position={[0.75, -1.25, 0]}>
      <RoundedBox args={[12, 0.28, 9]} radius={0.18} smoothness={3} position={[0, -0.16, 0]} receiveShadow>
        <meshStandardMaterial color={COLORS.ground} roughness={0.96} />
      </RoundedBox>
      <RoundedBox args={[7.8, 0.06, 1.65]} radius={0.12} smoothness={3} position={[2.1, 0.02, 2.55]} rotation={[0, -0.1, 0]} receiveShadow>
        <meshStandardMaterial color={COLORS.path} roughness={0.95} />
      </RoundedBox>
      <MainHome />
      <Neighbor position={[-4.25, 0, -1.2]} height={3.8} color={COLORS.sand} />
      <Neighbor position={[3.7, 0, -2.15]} height={2.85} color="#e7dfcf" />
      <Tree position={[-4.4, 0, 2.1]} scale={1.15} />
      <Tree position={[4.35, 0, 0.3]} scale={0.9} />
      <Tree position={[1.7, 0, -3.15]} scale={0.78} />
      <ServiceVan />
      <ContactShadows position={[0, -0.29, 0]} opacity={0.27} scale={13} blur={2.8} far={7} color="#48534b" />
    </group>
  );
}

function SceneReady({ onReady }: { onReady(): void }) {
  useEffect(() => onReady(), [onReady]);
  return null;
}

export default function PropertyScene({
  activeStage,
  onReady,
}: {
  activeStage: number;
  onReady(): void;
}) {
  const reducedMotion = useReducedMotion() ?? false;
  void activeStage;

  return (
    <div className={styles.canvasWrap} aria-hidden="true">
      <Canvas
        orthographic
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [8.6, 7.2, 10.5], zoom: 62, near: 0.1, far: 80 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={1.65} />
        <hemisphereLight args={["#f7fbf3", "#91a08c", 1.6]} />
        <directionalLight
          castShadow
          color="#fff4d8"
          intensity={3.1}
          position={[-5, 10, 7]}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-far={25}
          shadow-camera-left={-9}
          shadow-camera-right={9}
          shadow-camera-top={9}
          shadow-camera-bottom={-9}
        />
        <PropertyModel reducedMotion={reducedMotion} />
        <SceneReady onReady={onReady} />
      </Canvas>
    </div>
  );
}
