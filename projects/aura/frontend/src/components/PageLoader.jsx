import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import DecorativeShapes from "./DecorativeShapes";

const PageLoader = () => {
  const containerRef = useRef(null);
  const dotRefs = useRef([]);

  useEffect(() => {
    const dots = dotRefs.current;
    if (dots.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.4, ease: "power2.out" }
      );

      dots.forEach((dot, i) => {
        gsap.to(dot, {
          y: -14,
          opacity: 0.25,
          duration: 0.7,
          repeat: -1,
          yoyo: true,
          ease: "power2.inOut",
          delay: i * 0.18,
        });
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      className="min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "var(--aura-bg)" }}
    >
      <DecorativeShapes variant="loading" />

      <div className="flex flex-col items-center gap-6 relative z-10">
        {/* Animated shapes as loader icon */}
        <div className="relative flex items-center justify-center w-20 h-20">
          <motion.div
            className="absolute w-12 h-12 rounded-full"
            style={{
              background: "linear-gradient(135deg, #A594F9, #CDC1FF)",
              filter: "blur(2px)",
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.6, 1, 0.6],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute w-6 h-6 rounded-full"
            style={{ background: "#8B78E8" }}
            animate={{
              scale: [1, 0.7, 1],
              opacity: [0.8, 0.3, 0.8],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.5,
            }}
          />
        </div>

        {/* Bouncing dots */}
        <div className="flex items-center gap-2.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              ref={(el) => (dotRefs.current[i] = el)}
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: "var(--aura-accent)" }}
            />
          ))}
        </div>

        <span
          className="text-sm font-medium tracking-widest uppercase"
          style={{ color: "var(--aura-text-secondary)" }}
        >
          Loading
        </span>
      </div>
    </div>
  );
};

export default PageLoader;
