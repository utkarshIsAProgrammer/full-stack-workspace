import { useEffect, useRef } from "react";
import * as THREE from "three";
import { hasWebGL } from "../utils/hasWebGL";

export default function LandingSpaceBackdrop() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const etherCanvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseRef.current.targetX = x;
      mouseRef.current.targetY = y;
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  useEffect(() => {
    if (!hasWebGL() || isMobile) return;
    const canvas = canvasRef.current;
    const etherCanvas = etherCanvasRef.current;
    if (!canvas || !etherCanvas) return;

    let width = window.innerWidth;
    let height = window.innerHeight;

    etherCanvas.width = width;
    etherCanvas.height = height;
    const eCtx = etherCanvas.getContext("2d");

    // Liquid Ether wave states - extremely slow & subtle flow
    const etherWaves = [
      { frequency: 0.0012, amplitude: 45, speed: 0.03, yOffset: height * 0.35, phase: 0, color: "rgba(255, 255, 255, 0.012)" },
      { frequency: 0.0008, amplitude: 60, speed: -0.02, yOffset: height * 0.55, phase: 2.1, color: "rgba(200, 200, 200, 0.008)" },
      { frequency: 0.0018, amplitude: 30, speed: 0.04, yOffset: height * 0.22, phase: 4.5, color: "rgba(255, 255, 255, 0.01)" }
    ];

    // 1. Scene Creator
    const scene = new THREE.Scene();

    // 2. Camera Setup (perfect sizing for the hollow metallic paint orb)
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.z = 20;

    // 3. WebGL Renderer with High-Gloss Specular properties (wrapped in try-catch for headless compat)
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance"
      });
    } catch {
      // WebGL not available (e.g. headless Chromium)
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const gl = renderer.getContext();
    if (gl) gl.getExtension("EXT_float_blend");

    // 4. White & Silver Specular Lights (Strict Monochromatic Theme)
    const ambientLight = new THREE.AmbientLight(0x1a1a1a, 1.5);
    scene.add(ambientLight);

    // Directional silver backlights
    const lightFront = new THREE.DirectionalLight(0xffffff, 4.0);
    lightFront.position.set(0, 15, 10);
    scene.add(lightFront);

    const lightBack = new THREE.DirectionalLight(0x777777, 3.0);
    lightBack.position.set(0, -15, -10);
    scene.add(lightBack);

    // High specular side-shimmer light
    const lightSpecular = new THREE.DirectionalLight(0xcccccc, 2.5);
    lightSpecular.position.set(15, 5, 5);
    scene.add(lightSpecular);

    const lightSpecularLeft = new THREE.DirectionalLight(0xffffff, 2.0);
    lightSpecularLeft.position.set(-15, -5, 5);
    scene.add(lightSpecularLeft);

    // 5. THE HOLLOW METALLIC ORB (Masterpiece Hollow Architecture)
    const orbGroup = new THREE.Group();
    scene.add(orbGroup);

    // Create a gorgeous deforming metallic low-poly wireframe sphere representing the hollow core
    const geometry = new THREE.IcosahedronGeometry(6.5, 4); // Spacious size to perfectly frame text

    // Metallic wireframe material
    const wireMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xdddddd,
      roughness: 0.15,
      metalness: 1.0, // High metalness for chrome look
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      wireframe: true,
      wireframeLinewidth: 1.5,
      side: THREE.DoubleSide
    });

    const wireMesh = new THREE.Mesh(geometry, wireMaterial);
    orbGroup.add(wireMesh);

    // Secondary inner crystalline grid (slightly smaller to give complex hollow layering)
    const innerGeometry = new THREE.IcosahedronGeometry(5.8, 3);
    const innerMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x888888,
      roughness: 0.2,
      metalness: 1.0,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });
    const innerMesh = new THREE.Mesh(innerGeometry, innerMaterial);
    orbGroup.add(innerMesh);

    // Keep track of original raw coordinates for water-flow deformation
    const posAttr = geometry.attributes.position;
    const initialPositions = new Float32Array(posAttr.count * 3);
    for (let i = 0; i < posAttr.count; i++) {
      initialPositions[i * 3] = posAttr.getX(i);
      initialPositions[i * 3 + 1] = posAttr.getY(i);
      initialPositions[i * 3 + 2] = posAttr.getZ(i);
    }

    // 6. Ambient Monochromatic Star Dust particle system drifting in 3D
    const particleCount = 200;
    const starsGeom = new THREE.BufferGeometry();
    const starCoords = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 9.0 + Math.random() * 8.0;
      starCoords[i * 3] = Math.cos(angle) * radius;
      starCoords[i * 3 + 1] = (Math.random() - 0.5) * 16;
      starCoords[i * 3 + 2] = (Math.random() - 0.5) * 12;
    }
    starsGeom.setAttribute("position", new THREE.BufferAttribute(starCoords, 3));

    // Soft particle point map texture
    const makeDot = () => {
      const pCanvas = document.createElement("canvas");
      pCanvas.width = 16;
      pCanvas.height = 16;
      const ctx = pCanvas.getContext("2d");
      if (ctx) {
        const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
        grad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 16, 16);
      }
      const tex = new THREE.CanvasTexture(pCanvas);
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      return tex;
    };

    const starsMaterial = new THREE.PointsMaterial({
      size: 0.18,
      transparent: true,
      opacity: 0.4,
      map: makeDot(),
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const starPoints = new THREE.Points(starsGeom, starsMaterial);
    scene.add(starPoints);

    // 7. Resize handle
    const handleResize = () => {
      if (!canvasRef.current || !etherCanvasRef.current) return;
      width = window.innerWidth;
      height = window.innerHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);

      etherCanvasRef.current.width = width;
      etherCanvasRef.current.height = height;

      etherWaves[0].yOffset = height * 0.35;
      etherWaves[1].yOffset = height * 0.55;
      etherWaves[2].yOffset = height * 0.22;
    };
    window.addEventListener("resize", handleResize);

    // 8. Animation loop with organic metallic paint swaying deforms
    let animationFrameId: number;
    const timer = new THREE.Timer();
    timer.connect(document);

    const animate = (timestamp?: number) => {
      animationFrameId = requestAnimationFrame(animate);

      timer.update(timestamp);
      const delta = timer.getDelta();
      const elapsedTime = timer.getElapsed();

      // Mouse Parallax displacement (extremely damped for subtle elegance)
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 1.5 * delta;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 1.5 * delta;

      // Group rotation (slowed down for a serene, premium feel)
      orbGroup.rotation.y = elapsedTime * 0.025 + mouseRef.current.x * 0.05;
      orbGroup.rotation.x = elapsedTime * 0.010 - mouseRef.current.y * 0.04;

      // Slowly float the Star Dust coords - reduced speed for tranquil mood
      const ptArray = starsGeom.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        ptArray[i * 3 + 1] += Math.sin(elapsedTime * 0.08 + i) * 0.0015;
      }
      starsGeom.attributes.position.needsUpdate = true;

      // Subtle metallic-liquid deforming ripples (simulating fluid metal paint) - reduced vibration speed significantly
      const currentPosAttr = geometry.attributes.position;
      const waveSpeed = elapsedTime * 0.25; // reduced flow frequency/speed of deforming wireframe

      for (let i = 0; i < currentPosAttr.count; i++) {
        const x = initialPositions[i * 3];
        const y = initialPositions[i * 3 + 1];
        const z = initialPositions[i * 3 + 2];

        const length = Math.sqrt(x * x + y * y + z * z);
        const nx = x / length;
        const ny = y / length;
        const nz = z / length;

        // Overlay harmonic sine waves to create dynamic metal plate vibration look
        const r1 = Math.sin(nx * 3.0 + waveSpeed) * 0.12;
        const r2 = Math.cos(ny * 3.5 - waveSpeed * 0.6) * 0.09;
        const r3 = Math.sin((nz + nx) * 2.5 + waveSpeed * 0.8) * 0.07;

        const totalStretch = (r1 + r2 + r3) * 0.65;

        currentPosAttr.setXYZ(
          i,
          x + nx * totalStretch,
          y + ny * totalStretch,
          z + nz * totalStretch
        );
      }
      currentPosAttr.needsUpdate = true;
      geometry.computeVertexNormals();

      // Render 3D Canvas
      renderer.render(scene, camera);

      // Render 2D overlays (Liquid Ether)
      if (eCtx) {
        eCtx.clearRect(0, 0, width, height);

        // A. Draw liquid ether wave bands
        eCtx.save();
        etherWaves.forEach((wave) => {
          wave.phase += wave.speed * 0.012; // extremely slowed flow frequency
          eCtx.beginPath();
          eCtx.strokeStyle = wave.color;
          eCtx.lineWidth = 1.3;

          for (let px = 0; px < width; px += 6) {
            const py = wave.yOffset + Math.sin(px * wave.frequency + wave.phase) * wave.amplitude;
            if (px === 0) {
              eCtx.moveTo(px, py);
            } else {
              eCtx.lineTo(px, py);
            }
          }
          eCtx.stroke();
        });
        eCtx.restore();
      }
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);

      geometry.dispose();
      wireMaterial.dispose();
      innerGeometry.dispose();
      innerMaterial.dispose();
      starsGeom.dispose();
      starsMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      timer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 select-none pointer-events-none bg-black overflow-hidden z-0"
    >
      {/* 1. Monochromatic Sky Aurora overlay */}
      <div className="absolute inset-x-0 top-0 h-[65vh] z-0 opacity-40 pointer-events-none overflow-hidden">
        {/* Soft white shifting aurora curtain at the top */}
        <div className="absolute top-[-5%] left-[10%] w-[85vw] h-[45vh] rounded-full bg-linear-to-b from-white/10 via-zinc-100/4 to-transparent blur-[110px] animate-aurora-top" />

        {/* Secondary silver glow drifting slowly */}
        <div className="absolute top-[2%] right-[15%] w-[65vw] h-[35vh] rounded-full bg-linear-to-b from-zinc-200/6 via-zinc-400/2 to-transparent blur-[120px] animate-aurora-top-delayed" />

        {/* Radial ambient chrome dark spot in inner center */}
        <div className="absolute left-[50%] -translate-x-1/2 top-0 w-[50vw] h-[50vw] bg-radial-gradient from-white/4 to-transparent blur-[130px] opacity-60" />
      </div>

      {/* Structured precision layout grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.002)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.002)_1px,transparent_1px)] bg-size[48px_48px] opacity-15 mix-blend-overlay z-1" />

      {/* 2. Three.js canvas layer */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block z-2 mix-blend-screen" />

      {/* 3. Liquid ether wave 2D overlay */}
      <canvas ref={etherCanvasRef} className="absolute inset-0 w-full h-full block z-3 mix-blend-screen" />

      <style>{`
        @keyframes aurora-top {
          0%, 100% {
            transform: translate(0px, 0px) scale(1) rotate(0deg);
          }
          50% {
            transform: translate(30px, 15px) scale(1.05) rotate(15deg);
          }
        }
        @keyframes aurora-top-delayed {
          0%, 100% {
            transform: translate(0px, 0px) scale(1) rotate(0deg);
          }
          50% {
            transform: translate(-30px, -15px) scale(0.95) rotate(-15deg);
          }
        }
        .animate-aurora-top {
          animation: aurora-top 45s ease-in-out infinite;
        }
        .animate-aurora-top-delayed {
          animation: aurora-top-delayed 55s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
