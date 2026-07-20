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
  const [isLargeScreen, setIsLargeScreen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= 768;
  });
  const [disableCanvas, setDisableCanvas] = useState(() => {
    if (typeof navigator !== "undefined" && (navigator as any).brave) {
      return true;
    }
    return false;
  });

  useEffect(() => {
    const checkScreen = () => {
      setIsLargeScreen(window.innerWidth >= 768);
    };
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  useEffect(() => {
    if (!isLargeScreen || disableCanvas) return;
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
  }, [isLargeScreen, disableCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isLargeScreen || disableCanvas || !hasWebGL()) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let geometry: THREE.PlaneGeometry | null = null;
    let material: THREE.MeshPhysicalMaterial | null = null;
    let timer: THREE.Timer | null = null;
    let animationFrameId: number | null = null;
    let handleResize: (() => void) | null = null;
    let handleVisibility: (() => void) | null = null;

    try {
      let width = window.innerWidth;
      let height = window.innerHeight;

      // 1. Initialize ThreeJS Scene
      const scene = new THREE.Scene();

      // 2. Camera Setup
      const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
      camera.position.set(0, 0, 24);

      // 3. WebGL Renderer with High-Reflectivity Glass configurations
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

      const gl = renderer.getContext();
      if (gl) gl.getExtension("EXT_float_blend");

      // 4. Create Liquid Glass Organic Wave Mesh
      // Large plane stretching across the viewport
      const cols = 24;
      const rows = 18;
      geometry = new THREE.PlaneGeometry(60, 42, cols, rows);

      // Premium glossy space-liquid material using MeshPhysicalMaterial
      material = new THREE.MeshPhysicalMaterial({
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

      // 5. Lighting setup
      const ambientLight = new THREE.AmbientLight(0x0c0c10, 0.95);
      scene.add(ambientLight);

      const indigoLight = new THREE.SpotLight(0xffffff, 200, 150, Math.PI / 3, 0.6, 1.2);
      indigoLight.position.set(-15, 15, 10);
      scene.add(indigoLight);

      const tealLight = new THREE.SpotLight(0xa1a1aa, 150, 150, Math.PI / 3, 0.6, 1.2);
      tealLight.position.set(15, -15, 10);
      scene.add(tealLight);

      const purpleLight = new THREE.SpotLight(0x3f3f46, 160, 150, Math.PI / 3, 0.6, 1.2);
      purpleLight.position.set(5, 5, 12);
      scene.add(purpleLight);

      // 6. Timer for smooth time-based animation increments
      timer = new THREE.Timer();
      timer.connect(document);

      // 7. Handle Window Resize
      handleResize = () => {
        if (!renderer) return;
        width = window.innerWidth;
        height = window.innerHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      };
      window.addEventListener("resize", handleResize);

      // 8. Performance setup
      let tabHidden = false;
      let frameCount = 0;
      const FRAME_SKIP = 2; // render every 2nd frame

      handleVisibility = () => {
        tabHidden = document.hidden;
      };
      document.addEventListener("visibilitychange", handleVisibility);

      // 9. Main Render Loop
      const animateScene = (timestamp?: number) => {
        if (!renderer || !timer || !geometry || !material) return;

        if (tabHidden) {
          animationFrameId = requestAnimationFrame(animateScene);
          return;
        }

        frameCount++;
        if (frameCount % FRAME_SKIP !== 0) {
          animationFrameId = requestAnimationFrame(animateScene);
          return;
        }

        timer.update(timestamp);
        const timeVal = timer.getElapsed() * 0.45;

        // Smooth mouse coordinate interpolation
        interpMouseRef.current.x += (mouseCoordsRef.current.x - interpMouseRef.current.x) * 0.05;
        interpMouseRef.current.y += (mouseCoordsRef.current.y - interpMouseRef.current.y) * 0.05;

        mesh.rotation.y = interpMouseRef.current.x * 0.14;
        mesh.rotation.x = -interpMouseRef.current.y * 0.14;

        indigoLight.position.x = -15 + interpMouseRef.current.x * 12 + Math.cos(timeVal * 0.7) * 4;
        indigoLight.position.y = 15 + interpMouseRef.current.y * 12 + Math.sin(timeVal * 0.7) * 4;

        tealLight.position.x = 15 + interpMouseRef.current.x * 12 + Math.sin(timeVal * 0.5) * 5;
        tealLight.position.y = -15 + interpMouseRef.current.y * 12 + Math.cos(timeVal * 0.5) * 5;

        // Vertex Displacements dynamically
        const positions = geometry.attributes.position;
        if (positions) {
          for (let i = 0; i < positions.count; i++) {
            const vx = positions.getX(i);
            const vy = positions.getY(i);

            const wave1 = Math.sin(vx * 0.12 + timeVal) * 1.6;
            const wave2 = Math.cos(vy * 0.14 + timeVal * 1.15) * 1.6;
            const wave3 = Math.sin((vx + vy) * 0.07 + timeVal * 0.72) * 1.25;

            const mx = interpMouseRef.current.x * 20;
            const my = interpMouseRef.current.y * 15;
            const distToMouse = Math.sqrt((vx - mx) ** 2 + (vy - my) ** 2);
            const mouseRipple = Math.sin(distToMouse * 0.28 - timeVal * 2.8) * Math.max(0, 4.5 - distToMouse * 0.15) * 0.35;

            positions.setZ(i, wave1 + wave2 + wave3 + mouseRipple);
          }
          positions.needsUpdate = true;
          geometry.computeVertexNormals();
        }

        renderer.render(scene, camera);
        animationFrameId = requestAnimationFrame(animateScene);
      };

      animateScene();

    } catch (err) {
      console.warn("WebGL initialization failed, falling back to CSS background:", err);
      setDisableCanvas(true);
      return;
    }

    return () => {
      if (handleVisibility) {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
      if (handleResize) {
        window.removeEventListener("resize", handleResize);
      }
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      const safeDispose = (obj: any, method: string) => {
        if (obj) {
          try {
            obj[method]();
          } catch { /* best-effort cleanup */ }
        }
      };
      safeDispose(renderer, 'dispose');
      if (renderer) { try { renderer.forceContextLoss(); } catch {} }
      safeDispose(geometry, 'dispose');
      safeDispose(material, 'dispose');
      safeDispose(timer, 'dispose');
    };
  }, [isLargeScreen, disableCanvas]);

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
      {isLargeScreen && !disableCanvas && <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />}
    </div>
  );
}
