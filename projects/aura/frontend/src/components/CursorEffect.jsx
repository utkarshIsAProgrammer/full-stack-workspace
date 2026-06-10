import { useRef, useEffect } from "react";

const CursorEffect = () => {
  const dotRef = useRef(null);

  useEffect(() => {
    const dot = dotRef.current;
    if (!dot) return;

    const handleMouse = (e) => {
      dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    };

    window.addEventListener("mousemove", handleMouse, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  return (
    <div
      ref={dotRef}
      className="fixed top-0 left-0 z-[9999] pointer-events-none"
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: "#A594F9",
        opacity: 0.5,
        transform: "translate(-100px, -100px)",
        willChange: "transform",
        transition: "opacity 0.2s ease",
      }}
    />
  );
};

export default CursorEffect;
