import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { BufferGeometry, BufferAttribute, AdditiveBlending } from "three";

const PARTICLE_COLORS = ["#A594F9", "#CDC1FF", "#E5D9F2", "#8B78E8"];
const DARK_PARTICLE_COLORS = ["#B8A8FF", "#E0D6FF", "#F0E8FF", "#A084FF"];
const PARTICLE_COUNT = 150;

function Particles({ mouseRef, scrollSpeed }) {
  const groupRef = useRef();
  const geometryRef = useRef(null);

  const [isDark, setIsDark] = useState(
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Positions: generated once, stable across theme toggles (no visual jump)
  const positions = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const radius = 6 + Math.random() * 12;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);
    }
    return pos;
  }, []);

  // Colors: regenerated only when dark mode changes
  const colors = useMemo(() => {
    const cols = new Float32Array(PARTICLE_COUNT * 3);
    const colorSet = isDark ? DARK_PARTICLE_COLORS : PARTICLE_COLORS;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const color = colorSet[Math.floor(Math.random() * colorSet.length)];
      const r = parseInt(color.slice(1, 3), 16) / 255;
      const g = parseInt(color.slice(3, 5), 16) / 255;
      const b = parseInt(color.slice(5, 7), 16) / 255;

      cols[i * 3] = r;
      cols[i * 3 + 1] = g;
      cols[i * 3 + 2] = b;
    }
    return cols;
  }, [isDark]);

  const initialPos = useMemo(() => new Float32Array(positions), [positions]);
  const phases = useMemo(() => {
    const p = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) p[i] = Math.random() * Math.PI * 2;
    return p;
  }, []);

  // Mutable copy of positions — modified in-place by the animation loop
  const currentPos = useMemo(() => new Float32Array(positions), [positions]);

  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(currentPos, 3));
    geo.setAttribute("color", new BufferAttribute(colors, 3));
    return geo;
  }, [currentPos, colors]);

  useFrame((state) => {
    const { clock } = state;
    const time = clock.getElapsedTime();
    const scroll = scrollSpeed?.current ?? 1;

    const targetRotY = (mouseRef.current?.x ?? 0) * 0.4 * scroll;
    const targetRotX = (mouseRef.current?.y ?? 0) * 0.25 * scroll;

    if (groupRef.current) {
      groupRef.current.rotation.y += (targetRotY - groupRef.current.rotation.y) * 0.015 * scroll;
      groupRef.current.rotation.x += (targetRotX - groupRef.current.rotation.x) * 0.012 * scroll;
    }

    const posAttr = geometryRef.current?.attributes?.position;
    if (!posAttr) return;

    const array = posAttr.array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const phase = phases[i];
      const waveSpeed = 0.3 * scroll;

      const targetX = initialPos[i3] + Math.sin(time * waveSpeed + phase) * 0.4;
      const targetY = initialPos[i3 + 1] + Math.cos(time * waveSpeed * 1.3 + phase * 1.3) * 0.4;
      const targetZ = initialPos[i3 + 2] + Math.sin(time * waveSpeed * 1.17 + phase * 0.7) * 0.4;

      const mouseInfluenceX = (mouseRef.current?.x ?? 0) * 0.5 * scroll;
      const mouseInfluenceY = (mouseRef.current?.y ?? 0) * 0.3 * scroll;

      const lerp = 0.02 * scroll;
      array[i3] += ((targetX + mouseInfluenceX) - array[i3]) * lerp;
      array[i3 + 1] += ((targetY + mouseInfluenceY) - array[i3 + 1]) * lerp;
      array[i3 + 2] += (targetZ - array[i3 + 2]) * lerp;
    }

    posAttr.needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      <points geometry={geometry} ref={geometryRef}>
        <pointsMaterial
          size={isDark ? 0.45 : 0.3}
          vertexColors
          transparent
          opacity={isDark ? 0.95 : 0.9}
          sizeAttenuation
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>
    </group>
  );
}

const ParticleBackground = ({ scrollSpeed }) => {
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouse = (e) => {
      mouseRef.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1,
      };
    };

    window.addEventListener("mousemove", handleMouse, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 12], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Particles mouseRef={mouseRef} scrollSpeed={scrollSpeed} />
      </Canvas>
    </div>
  );
};

export default ParticleBackground;
