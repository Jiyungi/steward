"use client";

import { Line, RoundedBox } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useReducedMotion } from "motion/react";
import { useRef } from "react";
import type { Group } from "three";

import styles from "./scene.module.css";

const harbor = "#54b4df";
const harborDeep = "#126184";
const amber = "#f0b84d";
const neutral = "#8ea1aa";

function ConnectionPath({ points, color }: { points: [number, number, number][]; color: string }) {
  return <Line points={points} color={color} lineWidth={1.2} transparent opacity={0.58} />;
}

function PropertyModel({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<Group>(null);

  useFrame(({ pointer }, delta) => {
    if (reducedMotion || group.current === null) return;
    const targetX = -0.16 + pointer.y * 0.075;
    const targetY = -0.44 + pointer.x * 0.09;
    group.current.rotation.x += (targetX - group.current.rotation.x) * Math.min(delta * 2.3, 1);
    group.current.rotation.y += (targetY - group.current.rotation.y) * Math.min(delta * 2.3, 1);
  });

  return (
    <group ref={group} rotation={[-0.16, -0.44, 0]} position={[0, -0.1, 0]}>
      <RoundedBox args={[5.2, 0.22, 3.8]} radius={0.12} smoothness={3} position={[0, -0.95, 0]}>
        <meshStandardMaterial color="#101b21" roughness={0.66} metalness={0.18} />
      </RoundedBox>

      <RoundedBox args={[2.15, 1.7, 1.65]} radius={0.11} smoothness={3} position={[-0.8, -0.02, -0.42]}>
        <meshStandardMaterial color="#183440" roughness={0.52} metalness={0.16} />
      </RoundedBox>
      <RoundedBox args={[1.55, 1.15, 1.4]} radius={0.1} smoothness={3} position={[1.18, -0.28, 0.5]}>
        <meshStandardMaterial color="#15303b" roughness={0.5} metalness={0.2} />
      </RoundedBox>
      <RoundedBox args={[1.1, 0.18, 1.1]} radius={0.08} smoothness={3} position={[0.05, 0.05, 1.12]}>
        <meshStandardMaterial color="#22536a" roughness={0.42} metalness={0.25} />
      </RoundedBox>

      <mesh position={[-3.25, 0.1, 0.45]}>
        <sphereGeometry args={[0.16, 20, 20]} />
        <meshStandardMaterial color={amber} emissive={amber} emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0.05, 1.22, 0.05]}>
        <octahedronGeometry args={[0.31, 0]} />
        <meshStandardMaterial color={harbor} emissive={harborDeep} emissiveIntensity={2.1} metalness={0.2} />
      </mesh>
      <mesh position={[3.02, 0.22, 0.3]} rotation={[0.4, 0.2, 0]}>
        <boxGeometry args={[0.36, 0.36, 0.36]} />
        <meshStandardMaterial color={neutral} emissive="#30454f" emissiveIntensity={0.6} metalness={0.45} />
      </mesh>
      <mesh position={[2.65, 1.82, -0.25]} rotation={[0.1, 0.25, 0]}>
        <torusGeometry args={[0.32, 0.065, 12, 36]} />
        <meshStandardMaterial color={harbor} emissive={harborDeep} emissiveIntensity={1.6} />
      </mesh>
      <mesh position={[2.65, 1.82, -0.25]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color="#d7f4ff" emissive={harbor} emissiveIntensity={1.4} />
      </mesh>

      <ConnectionPath
        points={[
          [-3.1, 0.1, 0.44],
          [-1.8, 0.2, 0.15],
          [0.02, 1.06, 0.05],
        ]}
        color={amber}
      />
      <ConnectionPath
        points={[
          [0.23, 1.1, 0.05],
          [1.35, 0.8, 0.2],
          [2.85, 0.3, 0.3],
        ]}
        color={harbor}
      />
      <ConnectionPath
        points={[
          [3, 0.42, 0.28],
          [3.05, 1.08, 0.05],
          [2.73, 1.62, -0.2],
        ]}
        color={neutral}
      />
    </group>
  );
}

export default function PropertyScene() {
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = prefersReducedMotion ?? false;

  return (
    <div className={styles.canvasWrap} aria-hidden="true" data-testid="three-scene">
      <Canvas
        camera={{ position: [0, 2.8, 8.3], fov: 41 }}
        dpr={[1, 1.5]}
        frameloop={reducedMotion ? "demand" : "always"}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight color="#d9f4ff" intensity={2.4} position={[3, 6, 5]} />
        <pointLight color={amber} intensity={16} distance={5} position={[-3.1, 0.3, 1]} />
        <pointLight color={harbor} intensity={18} distance={6} position={[0, 2, 1]} />
        <PropertyModel reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
