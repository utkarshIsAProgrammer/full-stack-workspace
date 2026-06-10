import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router";
import gsap from "gsap";
import { SignInButton } from "@clerk/clerk-react";
import ParticleBackground from "../components/ParticleBackground";
import CursorEffect from "../components/CursorEffect";
import DecorativeShapes from "../components/DecorativeShapes";
import "../styles/auth.css";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] },
  },
};

const features = [
  { icon: "💬", text: "Real-time messaging" },
  { icon: "🎥", text: "Video calls & meetings" },
  { icon: "🔒", text: "Secure & private" },
];

const AuthPage = () => {
  const heroRef = useRef(null);
  const titleRef = useRef(null);
  const subtitleRef = useRef(null);
  const scrollSpeed = useRef(1);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const speed = 1 + Math.min(scrollY / window.innerHeight, 1) * 2;
      scrollSpeed.current = speed;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (titleRef.current) {
        gsap.fromTo(
          titleRef.current,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 1, ease: "power3.out", delay: 0.2 }
        );
      }
      if (subtitleRef.current) {
        gsap.fromTo(
          subtitleRef.current,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", delay: 0.4 }
        );
      }
      if (heroRef.current) {
        gsap.fromTo(
          heroRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.6, ease: "power2.out", delay: 0.1 }
        );
      }
    });
    return () => ctx.revert();
  }, []);

  return (
    <div className="auth-wrapper">
      <ParticleBackground scrollSpeed={scrollSpeed} />
      <CursorEffect />

      {/* ─── LEFT: Brand Hero Panel ─── */}
      <motion.div
        ref={heroRef}
        className="auth-left"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <DecorativeShapes variant="auth" />
        <div className="auth-left-content">
          <motion.div
            className="auth-brand"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <Link to="/" className="auth-brand-row">
              <img src="/logo.png" alt="Aura" className="auth-brand-logo" />
              <span className="auth-brand-name">Aura</span>
            </Link>

            <h1 ref={titleRef} className="auth-hero-title">
              A peaceful space<br />for your team
            </h1>

            <p ref={subtitleRef} className="auth-hero-subtitle">
              Connect, collaborate, and create together through serene
              real-time messaging and video calls.
            </p>
          </motion.div>

          <motion.div
            className="auth-features"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {features.map((feature) => (
              <motion.div
                key={feature.text}
                className="auth-feature-item"
                variants={itemVariants}
                whileHover={{ y: -6, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="auth-feature-icon">{feature.icon}</span>
                <span className="auth-feature-text">{feature.text}</span>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            className="auth-stats"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            <div className="auth-stat">
              <span className="auth-stat-number">10k+</span>
              <span className="auth-stat-label">Active users</span>
            </div>
            <div className="auth-stat-divider" />
            <div className="auth-stat">
              <span className="auth-stat-number">99.9%</span>
              <span className="auth-stat-label">Uptime</span>
            </div>
            <div className="auth-stat-divider" />
            <div className="auth-stat">
              <span className="auth-stat-number">150+</span>
              <span className="auth-stat-label">Countries</span>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* ─── RIGHT: Auth Panel ─── */}
      <div className="auth-right">
        <motion.div
          className="auth-card"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1], delay: 0.15 }}
        >
          <div className="auth-card-header">
            <h2 className="auth-card-title">Welcome back</h2>
            <p className="auth-card-subtitle">Sign in to continue to Aura</p>
          </div>

          <SignInButton mode="modal">
            <motion.button
              className="auth-cta-btn"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <svg className="auth-cta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Continue with Clerk
              <span className="auth-cta-arrow">→</span>
            </motion.button>
          </SignInButton>

          <div className="auth-divider">
            <span>Secure authentication</span>
          </div>

          <div className="auth-trust">
            <svg className="auth-trust-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>Your data is encrypted end-to-end</span>
          </div>
        </motion.div>

        <p className="auth-footer-text">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
