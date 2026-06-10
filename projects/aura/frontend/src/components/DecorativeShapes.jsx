import { useId, useState, useEffect } from "react";
import { motion } from "framer-motion";

// Module-level helper — accessible to all sub-components
function adjustColor(hex, amount) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount * 0.6));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount * 1.2));
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

// Coordinates are in viewBox space (0-1000) — viewBox="0 0 1000 1000"
const variants = {
  auth: {
    shapes: [
      { type: "blob", cx: 880, cy: 80, r: 260, color: "#A594F9", opacity: 0.12, float: 1 },
      { type: "blob", cx: 80, cy: 850, r: 200, color: "#CDC1FF", opacity: 0.15, float: 2 },
      { type: "circle", cx: 150, cy: 200, r: 60, color: "#A594F9", opacity: 0.1 },
      { type: "circle", cx: 220, cy: 140, r: 30, color: "#CDC1FF", opacity: 0.12 },
      { type: "circle", cx: 800, cy: 550, r: 120, color: "#E5D9F2", opacity: 0.14 },
      { type: "wave", y: 920, color: "#8B78E8", opacity: 0.08 },
      { type: "dots", x: 700, y: 800, color: "#A594F9", opacity: 0.1 },
    ],
  },
  chat: {
    shapes: [
      { type: "blob", cx: 50, cy: 50, r: 320, color: "#A594F9", opacity: 0.08, float: 1 },
      { type: "blob", cx: 950, cy: 920, r: 240, color: "#CDC1FF", opacity: 0.1, float: 3 },
      { type: "wave", y: 500, color: "#E5D9F2", opacity: 0.06 },
      { type: "circle", cx: 300, cy: 200, r: 45, color: "#A594F9", opacity: 0.06 },
      { type: "circle", cx: 700, cy: 750, r: 35, color: "#CDC1FF", opacity: 0.08 },
      { type: "circle", cx: 500, cy: 400, r: 25, color: "#8B78E8", opacity: 0.06 },
      { type: "dots", x: 850, y: 150, color: "#A594F9", opacity: 0.08 },
    ],
  },
  modal: {
    shapes: [
      { type: "circle", cx: 60, cy: 60, r: 40, color: "#CDC1FF", opacity: 0.1 },
      { type: "circle", cx: 940, cy: 940, r: 55, color: "#A594F9", opacity: 0.08 },
      { type: "dots", x: 500, y: 500, color: "#E5D9F2", opacity: 0.08 },
      { type: "blob", cx: 500, cy: 500, r: 180, color: "#E5D9F2", opacity: 0.08, float: 1 },
    ],
  },
  loading: {
    shapes: [
      { type: "blob", cx: 500, cy: 600, r: 300, color: "#A594F9", opacity: 0.12, float: 1 },
      { type: "blob", cx: 300, cy: 300, r: 200, color: "#CDC1FF", opacity: 0.14, float: 2 },
      { type: "blob", cx: 750, cy: 350, r: 180, color: "#E5D9F2", opacity: 0.1, float: 3 },
      { type: "circle", cx: 200, cy: 700, r: 50, color: "#A594F9", opacity: 0.08 },
      { type: "circle", cx: 800, cy: 800, r: 40, color: "#CDC1FF", opacity: 0.1 },
      { type: "dots", x: 500, y: 500, color: "#A594F9", opacity: 0.08 },
      { type: "wave", y: 900, color: "#8B78E8", opacity: 0.06 },
    ],
  },
};

function pseudoRandom(seed) {
  return ((seed * 9301 + 49297) % 233280) / 233280;
}

function Blob({ cx, cy, r, color, opacity, seed, float = 0, isDark }) {
  const id = useId();
  const ry = r * (0.6 + pseudoRandom(seed) * 0.25);
  const angle = (seed * 47 + 13) % 360;
  const opacityMultiplier = isDark ? 1.8 : 1;

  const floatAnim = float
    ? {
        y: [0, -8 - float * 3, 0],
        transition: {
          duration: 4 + float * 2,
          repeat: Infinity,
          ease: "easeInOut",
          delay: float * 0.7,
        },
      }
    : undefined;

  return (
    <motion.g animate={floatAnim}>
      <defs>
        <filter id={`blur-${id}`}>
          <feGaussianBlur stdDeviation={r * 0.12} />
        </filter>
      </defs>
      <ellipse
        cx={cx}
        cy={cy}
        rx={r}
        ry={ry}
        fill={isDark ? adjustColor(color, 120) : color}
        opacity={opacity * opacityMultiplier}
        filter={`url(#blur-${id})`}
        transform={`rotate(${angle}, ${cx}, ${cy})`}
      />
    </motion.g>
  );
}

function Wave({ y, color, opacity, isDark }) {
  return (
    <motion.g
      animate={{ opacity: [opacity, opacity * 0.6, opacity] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
    >
      <path
        d={`M 0 ${y}
            Q 125 ${y - 30}, 250 ${y + 10}
            T 500 ${y - 5}
            T 750 ${y + 15}
            T 1000 ${y - 10}
            L 1000 ${y + 80}
            L 0 ${y + 80} Z`}
        fill={isDark ? adjustColor(color, 100) : color}
      />
    </motion.g>
  );
}

function DotCluster({ x, y, color, opacity, isDark }) {
  const dots = [
    { dx: 0, dy: 0, r: 4 },
    { dx: 20, dy: -12, r: 2.5 },
    { dx: -15, dy: 18, r: 3 },
    { dx: 28, dy: 8, r: 2 },
    { dx: -25, dy: -8, r: 3.5 },
    { dx: 10, dy: 22, r: 1.5 },
  ];

  return (
    <motion.g
      animate={{
        opacity: [opacity, opacity * 0.5, opacity],
      }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
    >
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={x + d.dx}
          cy={y + d.dy}
          r={d.r}
          fill={isDark ? adjustColor(color, 60) : color}
        />
      ))}
    </motion.g>
  );
}

const DecorativeShapes = ({ variant = "auth" }) => {
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

  const config = variants[variant] || variants.auth;
  const opacityMultiplier = isDark ? 1.8 : 1;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      role="presentation"
    >
      {config.shapes.map((shape, i) => {
        switch (shape.type) {
          case "blob":
            return <Blob key={i} {...shape} seed={i * 7 + 3} isDark={isDark} />;
          case "wave":
            return <Wave key={i} {...shape} isDark={isDark} />;
          case "circle":
            return (
              <motion.circle
                key={i}
                cx={shape.cx}
                cy={shape.cy}
                r={shape.r}
                fill={isDark ? adjustColor(shape.color, 80) : shape.color}
                opacity={shape.opacity * opacityMultiplier}
                animate={{
                  opacity: [shape.opacity * opacityMultiplier, shape.opacity * 0.5 * opacityMultiplier, shape.opacity * opacityMultiplier],
                }}
                transition={{
                  duration: 5 + i,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.5,
                }}
              />
            );
          case "dots":
            return <DotCluster key={i} {...shape} isDark={isDark} />;
          default:
            return null;
        }
      })}
    </svg>
  );
};

export default DecorativeShapes;
