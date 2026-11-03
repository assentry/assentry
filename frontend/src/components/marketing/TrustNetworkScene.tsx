"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Line, Sparkles, Text } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

// The three entities HAPI connects, arranged as spokes around a central hub —
// "place HAPI as the intelligent trust layer connecting all three."
const HUMAN = new THREE.Vector3(-3.3, 1.4, -0.4);
const AGENT = new THREE.Vector3(0, -2.2, 0.8);
const WEBSITE = new THREE.Vector3(3.3, 1.4, -0.4);
const HUB = new THREE.Vector3(0, 0, 0);

const CYAN = "#22d3ee";
const VIOLET = "#a78bfa";
const RED = "#f87171";
const CYCLE_SECONDS = 9;

function NodeSphere({
  position,
  color,
  label,
  sublabel,
}: {
  position: THREE.Vector3;
  color: string;
  label: string;
  sublabel: string;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = clock.getElapsedTime();
    const scale = 1 + Math.sin(t * 1.4 + position.x) * 0.06;
    mesh.current.scale.setScalar(scale);
  });

  return (
    <Float speed={1.3} rotationIntensity={0.15} floatIntensity={0.6}>
      <group position={position}>
        <mesh ref={mesh}>
          <sphereGeometry args={[0.46, 32, 32]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} roughness={0.25} />
        </mesh>
        <pointLight color={color} intensity={6} distance={4} />
        <Text position={[0, -0.85, 0]} fontSize={0.26} color="#e2e8f0" anchorX="center" anchorY="middle">
          {label}
        </Text>
        <Text position={[0, -1.14, 0]} fontSize={0.16} color="#64748b" anchorX="center" anchorY="middle">
          {sublabel}
        </Text>
      </group>
    </Float>
  );
}

// At narrow (mobile) aspect ratios, a fixed camera distance clips the Human
// and Website nodes — they sit at a fixed world-space x offset, but the
// visible horizontal extent at a given depth shrinks with the aspect ratio.
// Push the camera back as the canvas gets narrower so all three entities
// stay in frame.
function ResponsiveCamera() {
  const { camera, size } = useThree();

  useEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const fovRad = (perspective.fov * Math.PI) / 180;
    const requiredHalfWidth = 4.2;
    const requiredDistance = requiredHalfWidth / (Math.tan(fovRad / 2) * aspect);
    perspective.position.z = Math.max(8.5, requiredDistance);
    perspective.updateProjectionMatrix();
  }, [camera, size]);

  return null;
}

function Hub() {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (!mesh.current) return;
    mesh.current.rotation.y += delta * 0.25;
    mesh.current.rotation.x += delta * 0.08;
  });
  return (
    <group position={HUB}>
      <mesh ref={mesh}>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshStandardMaterial
          color="#e0f2fe"
          emissive={CYAN}
          emissiveIntensity={0.7}
          roughness={0.15}
          wireframe
        />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[0.3, 1]} />
        <meshStandardMaterial color="#ffffff" emissive={CYAN} emissiveIntensity={1.1} />
      </mesh>
      <pointLight color={CYAN} intensity={10} distance={6} />
      <Text position={[0, 1.0, 0]} fontSize={0.22} color="#67e8f9" anchorX="center" anchorY="middle">
        HAPI
      </Text>
    </group>
  );
}

function Spoke({ from, to, color, dashOffset }: { from: THREE.Vector3; to: THREE.Vector3; color: string; dashOffset: number }) {
  const points = useMemo(() => [from, to], [from, to]);
  return (
    <Line
      points={points}
      color={color}
      transparent
      opacity={0.45}
      lineWidth={1.4}
      dashed
      dashSize={0.22}
      gapSize={0.16}
      dashOffset={dashOffset}
    />
  );
}

function Token({ progress, color, position }: { progress: number; color: string; position: THREE.Vector3 }) {
  if (progress <= 0 || progress >= 1) return null;
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.1, 16, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
    </mesh>
  );
}

function TrustNetwork() {
  const [, forceTick] = useState(0);
  const dashOffsetRef = useRef(0);
  const stateRef = useRef({
    humanToken: new THREE.Vector3().copy(HUMAN),
    agentToken: new THREE.Vector3().copy(HUB),
    resultToken: new THREE.Vector3().copy(HUB),
    humanProgress: 0,
    agentProgress: 0,
    resultProgress: 0,
    resultColor: CYAN,
  });

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    dashOffsetRef.current = -t * 0.6;

    const cyclePos = (t % CYCLE_SECONDS) / CYCLE_SECONDS;
    const cycleIndex = Math.floor(t / CYCLE_SECONDS);
    const authorized = cycleIndex % 2 === 0;

    const s = stateRef.current;

    // Leg 1 (0 - 0.33): permission flows from the human to HAPI.
    s.humanProgress = cyclePos < 1 / 3 ? cyclePos / (1 / 3) : 0;
    s.humanToken.lerpVectors(HUMAN, HUB, Math.min(1, s.humanProgress));

    // Leg 2 (0.33 - 0.66): HAPI delegates authority to the agent.
    const leg2 = cyclePos >= 1 / 3 && cyclePos < 2 / 3 ? (cyclePos - 1 / 3) / (1 / 3) : 0;
    s.agentProgress = leg2;
    s.agentToken.lerpVectors(HUB, AGENT, leg2);

    // Leg 3 (0.66 - 1.0): the agent's action reaches the website via a HAPI
    // verification check — cyan and it proceeds, red and it's blocked.
    const leg3 = cyclePos >= 2 / 3 ? (cyclePos - 2 / 3) / (1 / 3) : 0;
    s.resultProgress = leg3;
    s.resultColor = authorized ? CYAN : RED;
    const target = authorized ? WEBSITE : WEBSITE.clone().lerp(HUB, 0.35);
    s.resultToken.lerpVectors(HUB, target, leg3);

    forceTick((n) => (n + 1) % 1000000);
  });

  const s = stateRef.current;

  return (
    <>
      <ambientLight intensity={0.35} />
      <Sparkles count={60} scale={9} size={1.6} speed={0.25} color="#60a5fa" opacity={0.35} />

      <Spoke from={HUMAN} to={HUB} color={VIOLET} dashOffset={dashOffsetRef.current} />
      <Spoke from={HUB} to={AGENT} color={CYAN} dashOffset={dashOffsetRef.current} />
      <Spoke from={HUB} to={WEBSITE} color={s.resultColor} dashOffset={dashOffsetRef.current} />

      <Hub />
      <NodeSphere position={HUMAN} color={VIOLET} label="Human" sublabel="Owns the identity" />
      <NodeSphere position={AGENT} color={CYAN} label="AI Agent" sublabel="Claude · ChatGPT · Grok" />
      <NodeSphere position={WEBSITE} color="#38bdf8" label="Website" sublabel="Verifies authority" />

      <Token progress={s.humanProgress} color={VIOLET} position={s.humanToken} />
      <Token progress={s.agentProgress} color={CYAN} position={s.agentToken} />
      <Token progress={s.resultProgress} color={s.resultColor} position={s.resultToken} />
    </>
  );
}

export default function TrustNetworkScene() {
  return (
    <Canvas
      camera={{ position: [0, 0.4, 8.5], fov: 42 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
    >
      <ResponsiveCamera />
      <TrustNetwork />
    </Canvas>
  );
}
