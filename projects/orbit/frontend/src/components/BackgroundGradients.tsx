import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { hasWebGL } from "../utils/hasWebGL";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface BackgroundGradientsProps {
}

export default function BackgroundGradients({}: BackgroundGradientsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseCoordsRef = useRef({ x: 0, y: 0 });
  const interpMouseRef = useRef({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 768 || window.matchMedia("(pointer: coarse)").matches;
  });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(
        window.innerWidth < 768 ||
        window.matchMedia("(pointer: coarse)").matches
      );
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) return;
    const handleMouseMove = (e: MouseEvent) => {
      // Normalize coordinate drift (-1 to 1)
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseCoordsRef.current = { x, y };
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || isMobile || !hasWebGL()) return;

    let width = window.innerWidth;
    let height = window.innerHeight;

    // 1. Initialize ThreeJS Scene
    const scene = new THREE.Scene();

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    camera.position.set(0, 0, 24);

    // 3. WebGL Renderer with High-Reflectivity Glass configurations (wrapped in try-catch for headless compat)
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      // WebGL not available (e.g. headless Chromium)
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    const gl = renderer.getContext();
    if (gl) gl.getExtension("EXT_float_blend");

    // 4. Create Liquid Glass Organic Wave Mesh
    // Large plane stretching across the viewport
    const cols = 24;
    const rows = 18;
    const geometry = new THREE.PlaneGeometry(60, 42, cols, rows);

    // Premium glossy space-liquid material using MeshPhysicalMaterial for outstanding liquid glass feel
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x050508, // Obsidian black core
      roughness: 0.08,
      metalness: 0.82, // metallic dark liquid sheen
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      transmission: 0.08, // solid obsidian reflecting environment
      ior: 1.55, // realistic reflective refractions
      thickness: 1.5,
      specularIntensity: 1.8, // crisp highlights on wave peaks
      flatShading: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // 5. Lighting setup for beautiful liquid black chrome shimmering highlights
    // Ambient dark light
    const ambientLight = new THREE.AmbientLight(0x0c0c10, 0.95);
    scene.add(ambientLight);

    // Cool White Gloss Spotlight
    const indigoLight = new THREE.SpotLight(0xffffff, 200, 150, Math.PI / 3, 0.6, 1.2);
    indigoLight.position.set(-15, 15, 10);
    scene.add(indigoLight);

    // Cool Silver Shimmer Spotlight
    const tealLight = new THREE.SpotLight(0xa1a1aa, 150, 150, Math.PI / 3, 0.6, 1.2);
    tealLight.position.set(15, -15, 10);
    scene.add(tealLight);

    // Deep Dark Graphite Highlight Spotlight
    const purpleLight = new THREE.SpotLight(0x3f3f46, 160, 150, Math.PI / 3, 0.6, 1.2);
    purpleLight.position.set(5, 5, 12);
    scene.add(purpleLight);

    // 6. Timer for smooth time-based animation increments
    const timer = new THREE.Timer();
    timer.connect(document);

    // 7. Handle Window Resize
    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    // 8. Performance: pause when tab is hidden, frame-skip on mobile
    let tabHidden = false;
    let frameCount = 0;
    const FRAME_SKIP = 2; // render every 2nd frame → ~30fps target

    const handleVisibility = () => {
      tabHidden = document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // 9. Main Render & Fluid Dynamics Simulation Loop
    let animationFrameId: number;

    const animateScene = (timestamp?: number) => {
      // Pause entirely when tab is hidden — saves GPU + CPU
      if (tabHidden) {
        animationFrameId = requestAnimationFrame(animateScene);
        return;
      }

      // Frame-skip to lower effective framerate on mobile
      frameCount++;
      if (frameCount % FRAME_SKIP !== 0) {
        animationFrameId = requestAnimationFrame(animateScene);
        return;
      }

      timer.update(timestamp);
      const timeVal = timer.getElapsed() * 0.45;

      // Smooth mouse coordinate interpolation for organic response dynamics
      interpMouseRef.current.x += (mouseCoordsRef.current.x - interpMouseRef.current.x) * 0.05;
      interpMouseRef.current.y += (mouseCoordsRef.current.y - interpMouseRef.current.y) * 0.05;

      // Slight rotation of the mesh to mimic space-flow dynamics
      mesh.rotation.y = interpMouseRef.current.x * 0.14;
      mesh.rotation.x = -interpMouseRef.current.y * 0.14;

      // Animate spotlights coordinates slightly with mouse and sine wave loops
      indigoLight.position.x = -15 + interpMouseRef.current.x * 12 + Math.cos(timeVal * 0.7) * 4;
      indigoLight.position.y = 15 + interpMouseRef.current.y * 12 + Math.sin(timeVal * 0.7) * 4;

      tealLight.position.x = 15 + interpMouseRef.current.x * 12 + Math.sin(timeVal * 0.5) * 5;
      tealLight.position.y = -15 + interpMouseRef.current.y * 12 + Math.cos(timeVal * 0.5) * 5;

      // Vertex Displacements dynamically: Generating Water Flow Waves
      const positions = geometry.attributes.position;
      if (positions) {
        for (let i = 0; i < positions.count; i++) {
          const vx = positions.getX(i);
          const vy = positions.getY(i);

          // Combination of cascading mathematical wave currents representing fluid water currents
          const wave1 = Math.sin(vx * 0.12 + timeVal) * 1.6;
          const wave2 = Math.cos(vy * 0.14 + timeVal * 1.15) * 1.6;
          const wave3 = Math.sin((vx + vy) * 0.07 + timeVal * 0.72) * 1.25;

          // Interactive local mouse water ripples / localized pull
          const mx = interpMouseRef.current.x * 20;
          const my = interpMouseRef.current.y * 15;
          const distToMouse = Math.sqrt((vx - mx) ** 2 + (vy - my) ** 2);
          const mouseRipple = Math.sin(distToMouse * 0.28 - timeVal * 2.8) * Math.max(0, 4.5 - distToMouse * 0.15) * 0.35;

          positions.setZ(i, wave1 + wave2 + wave3 + mouseRipple);
        }
        positions.needsUpdate = true;
        // Make shading recalculations for gloss highlights
        geometry.computeVertexNormals();
      }

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animateScene);
    };

    animateScene();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      renderer.forceContextLoss();
      geometry.dispose();
      material.dispose();
      timer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 -z-30 select-none pointer-events-none bg-[#000000] overflow-hidden"
    >
      {/* High-Contrast grid network lines layer (underneath water, highly translucent) */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.005)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.005)_1px,transparent_1px)] bg-size[50px_50px] opacity-10" />

      {/* Primary Ambient Liquid Glass Spotlights behind the WebGL plane - cosmic theme */}
      <div className="absolute w-[60vw] h-[60vw] max-w-150 max-h-150 rounded-full filter blur-[140px] opacity-10 bg-linear-to-tr from-zinc-800 to-zinc-950 left-[15%] top-[10%] animate-pulse" />
      <div className="absolute w-[50vw] h-[50vw] max-w-125 max-h-125 rounded-full filter blur-[120px] opacity-10 bg-linear-to-br from-zinc-900 to-black right-[15%] bottom-[10%] animate-pulse" />

      {/* WebGL ThreeJS Liquid Canvas */}
      {!isMobile && <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />}
    </div>
  );
}
