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

// HAPI's brand palette for this composition (the "Intelligence Core" spec):
// deep midnight navy, electric cyan, turquoise, electric blue, violet/purple.
const CYAN = "#00d4ff";
const TURQUOISE = "#22e6d0";
const ELECTRIC_BLUE = "#398bff";
const VIOLET = "#8b5cf6";
const PURPLE = "#a78bfa";
const AMBER = "#f59e0b";
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
        {/* Layered soft halo behind the core — reads as a luminous glow
            rather than a flat-shaded ball. depthWrite is off so these
            transparent layers never occlude the labels/filament mesh
            behind them (they were, before this fix). */}
        <mesh>
          <sphereGeometry args={[0.78, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.08} depthWrite={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.6, 20, 20]} />
          <meshBasicMaterial color={color} transparent opacity={0.14} depthWrite={false} />
        </mesh>
        <mesh ref={mesh}>
          <sphereGeometry args={[0.42, 32, 32]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} roughness={0.2} />
        </mesh>
        <pointLight color={color} intensity={7} distance={4.5} />
        <Text position={[0, -0.95, 0]} fontSize={0.26} color="#e2e8f0" anchorX="center" anchorY="middle">
          {label}
        </Text>
        <Text position={[0, -1.24, 0]} fontSize={0.16} color="#64748b" anchorX="center" anchorY="middle">
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
    perspective.position.z = Math.max(9.5, requiredDistance);
    perspective.updateProjectionMatrix();
  }, [camera, size]);

  return null;
}

// A roughly-even distribution of points over a sphere's surface (golden-angle
// spiral) — the basis for the "thousands of interconnected filaments" hub,
// without the expense of an actual particle count in the thousands for a
// decorative hero visual.
function fibonacciSpherePoints(count: number, radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;
    points.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r).multiplyScalar(radius));
  }
  return points;
}

// Connects each point to its nearest few neighbours, producing an organic
// mesh of short filaments rather than a geometric solid — computed once,
// not per frame.
function buildFilamentMesh(points: THREE.Vector3[], neighbours: number) {
  const positions: number[] = [];
  const colors: number[] = [];
  const edgeSeen = new Set<string>();
  const cyanV = new THREE.Color(CYAN);
  const violetV = new THREE.Color(VIOLET);

  for (let i = 0; i < points.length; i++) {
    const distances = points
      .map((p, j) => ({ j, d: i === j ? Infinity : points[i].distanceTo(p) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, neighbours);

    for (const { j } of distances) {
      const key = i < j ? `${i}:${j}` : `${j}:${i}`;
      if (edgeSeen.has(key)) continue;
      edgeSeen.add(key);

      const a = points[i];
      const b = points[j];
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);

      const ca = cyanV.clone().lerp(violetV, (a.y / 1 + 1) / 2);
      const cb = cyanV.clone().lerp(violetV, (b.y / 1 + 1) / 2);
      colors.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b);
    }
  }

  return { positions: new Float32Array(positions), colors: new Float32Array(colors) };
}

// The luminous filament-sphere hub itself — HAPI's identity and
// authorisation infrastructure, not an "AI brain": an intricate organic
// mesh with a brilliant pulsing core, slowly rotating.
function IntelligenceCore() {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);

  const points = useMemo(() => fibonacciSpherePoints(220, 0.95), []);
  const { positions, colors } = useMemo(() => buildFilamentMesh(points, 4), [points]);

  useFrame(({ clock }, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.12;
      group.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.1) * 0.08;
    }
    const pulse = 1 + Math.sin(clock.getElapsedTime() * 1.6) * 0.1;
    if (core.current) core.current.scale.setScalar(pulse);
    if (light.current) light.current.intensity = 8 * pulse;
  });

  return (
    <group position={HUB}>
      <group ref={group}>
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            <bufferAttribute attach="attributes-color" args={[colors, 3]} />
          </bufferGeometry>
          <lineBasicMaterial vertexColors transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
        </lineSegments>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            <bufferAttribute attach="attributes-color" args={[colors, 3]} />
          </bufferGeometry>
          <pointsMaterial
            vertexColors
            size={0.05}
            sizeAttenuation
            transparent
            opacity={1}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
      </group>

      {/* Soft inner bloom behind the core, additive so it reads as light
          rather than a flat-shaded surface. */}
      <mesh>
        <sphereGeometry args={[0.42, 20, 20]} />
        <meshBasicMaterial color={CYAN} transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Brilliant pulsing core */}
      <mesh ref={core}>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshStandardMaterial color="#ffffff" emissive={CYAN} emissiveIntensity={1.6} />
      </mesh>
      <pointLight ref={light} color={CYAN} intensity={8} distance={5} />
      <pointLight color={VIOLET} intensity={4} distance={5} position={[0, 0, 0.4]} />

      <Text position={[0, 1.35, 0]} fontSize={0.22} color="#67e8f9" anchorX="center" anchorY="middle">
        HAPI
      </Text>
    </group>
  );
}

// Horizontal flowing energy ribbons extending from both sides of the core —
// a band made of a few parallel dashed curves rather than a solid tube, so
// it reuses the same proven dashed-line animation technique as the spokes.
function EnergyRibbon({ color, yOffset, zOffset, speed }: { color: string; yOffset: number; zOffset: number; speed: number }) {
  const curve = useMemo(() => {
    const pts = [
      new THREE.Vector3(-7, yOffset + Math.sin(0) * 0.3, zOffset),
      new THREE.Vector3(-3.5, yOffset + Math.sin(1.2) * 0.3, zOffset * 0.6),
      new THREE.Vector3(0, yOffset, 0),
      new THREE.Vector3(3.5, yOffset + Math.sin(-1.2) * 0.3, zOffset * 0.6),
      new THREE.Vector3(7, yOffset + Math.sin(0) * 0.3, zOffset),
    ];
    return new THREE.CatmullRomCurve3(pts).getPoints(80);
  }, [yOffset, zOffset]);

  const ref = useRef<{ dashOffset: number }>({ dashOffset: 0 });
  const [, forceTick] = useState(0);
  useFrame((_, delta) => {
    ref.current.dashOffset -= delta * speed;
    forceTick((n) => (n + 1) % 1000000);
  });

  return (
    <Line
      points={curve}
      color={color}
      transparent
      opacity={0.4}
      lineWidth={1.1}
      dashed
      dashSize={0.5}
      gapSize={0.6}
      dashOffset={ref.current.dashOffset}
    />
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

// Verification states, per the brand spec: cyan (authorised), amber (human
// approval required), red (denied) — cycling so the hero demonstrates all
// three outcomes over time, not just a binary allow/block.
const RESULT_STATES = [
  { color: CYAN, label: "authorised" },
  { color: AMBER, label: "approval" },
  { color: RED, label: "denied" },
] as const;

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
    resultColor: CYAN as string,
  });

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    dashOffsetRef.current = -t * 0.6;

    const cyclePos = (t % CYCLE_SECONDS) / CYCLE_SECONDS;
    const cycleIndex = Math.floor(t / CYCLE_SECONDS);
    const result = RESULT_STATES[cycleIndex % RESULT_STATES.length];

    const s = stateRef.current;

    // Leg 1 (0 - 0.33): permission flows from the human to HAPI.
    s.humanProgress = cyclePos < 1 / 3 ? cyclePos / (1 / 3) : 0;
    s.humanToken.lerpVectors(HUMAN, HUB, Math.min(1, s.humanProgress));

    // Leg 2 (0.33 - 0.66): HAPI delegates authority to the agent.
    const leg2 = cyclePos >= 1 / 3 && cyclePos < 2 / 3 ? (cyclePos - 1 / 3) / (1 / 3) : 0;
    s.agentProgress = leg2;
    s.agentToken.lerpVectors(HUB, AGENT, leg2);

    // Leg 3 (0.66 - 1.0): the agent's action reaches the website via a HAPI
    // verification check — cyan proceeds, amber waits on a human, red blocks.
    const leg3 = cyclePos >= 2 / 3 ? (cyclePos - 2 / 3) / (1 / 3) : 0;
    s.resultProgress = leg3;
    s.resultColor = result.color;
    const target = result.label === "authorised" ? WEBSITE : WEBSITE.clone().lerp(HUB, 0.35);
    s.resultToken.lerpVectors(HUB, target, leg3);

    forceTick((n) => (n + 1) % 1000000);
  });

  const s = stateRef.current;

  return (
    // Lifted so the AI Agent node's labels (the lowest point of the
    // composition) sit inside the camera's vertical field of view.
    <group position={[0, 0.8, 0]}>
      <ambientLight intensity={0.3} />
      <Sparkles count={60} scale={9} size={1.6} speed={0.25} color={ELECTRIC_BLUE} opacity={0.35} />

      <EnergyRibbon color={TURQUOISE} yOffset={2.4} zOffset={-1.4} speed={0.9} />
      <EnergyRibbon color={PURPLE} yOffset={-1.4} zOffset={-1.6} speed={0.7} />

      <Spoke from={HUMAN} to={HUB} color={VIOLET} dashOffset={dashOffsetRef.current} />
      <Spoke from={HUB} to={AGENT} color={CYAN} dashOffset={dashOffsetRef.current} />
      <Spoke from={HUB} to={WEBSITE} color={s.resultColor} dashOffset={dashOffsetRef.current} />

      <IntelligenceCore />
      <NodeSphere position={HUMAN} color={PURPLE} label="Human" sublabel="Owns the identity" />
      <NodeSphere position={AGENT} color={CYAN} label="AI Agent" sublabel="Claude · ChatGPT · Grok" />
      <NodeSphere position={WEBSITE} color={ELECTRIC_BLUE} label="Website" sublabel="Verifies authority" />

      <Token progress={s.humanProgress} color={VIOLET} position={s.humanToken} />
      <Token progress={s.agentProgress} color={CYAN} position={s.agentToken} />
      <Token progress={s.resultProgress} color={s.resultColor} position={s.resultToken} />
    </group>
  );
}

export default function TrustNetworkScene() {
  return (
    <Canvas
      camera={{ position: [0, 0.4, 9.5], fov: 42 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
    >
      <ResponsiveCamera />
      <TrustNetwork />
    </Canvas>
  );
}
