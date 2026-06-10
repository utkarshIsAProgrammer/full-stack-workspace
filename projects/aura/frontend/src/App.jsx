import { lazy, Suspense, useRef, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";

import * as Sentry from "@sentry/react";
import DecorativeShapes from "./components/DecorativeShapes";
import DarkModeToggle from "./components/DarkModeToggle";

const AuthPage = lazy(() => import("./pages/AuthPage"));
const CallPage = lazy(() => import("./pages/CallPage"));
const HomePage = lazy(() => import("./pages/HomePage"));

const SentryRoutes = Sentry.withSentryReactRouterV7Routing(Routes);

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  in: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
  out: { opacity: 0, y: -8, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] } },
};

const PageLoaderFallback = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (containerRef.current) {
        gsap.fromTo(
          containerRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.4, ease: "power2.out" }
        );
      }
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
      <div
        className="w-10 h-10 rounded-full"
        style={{
          border: "3px solid rgba(165, 148, 249, 0.15)",
          borderTopColor: "var(--aura-accent)",
          animation: "spin 0.8s linear infinite",
        }}
      />
    </div>
  );
};

const AnimatedPage = ({ children }) => (
  <motion.div
    initial="initial"
    animate="in"
    exit="out"
    variants={pageVariants}
  >
    {children}
  </motion.div>
);

const App = () => {
  const { isSignedIn, isLoaded } = useAuth();
  const location = useLocation();

  if (!isLoaded) return null;

  return (
    <Suspense fallback={<PageLoaderFallback />}>
      {/* Dark mode toggle — fixed top-right, visible on all pages */}
      <div
        className="fixed top-4 right-4 z-[9999]"
        style={{ isolation: "isolate" }}
      >
        <DarkModeToggle />
      </div>
      <AnimatePresence mode="wait">
        <SentryRoutes location={location} key={location.pathname}>
          <Route
            path="/"
            element={
              <AnimatedPage>
                {isSignedIn ? <HomePage /> : <Navigate to={"/auth"} replace />}
              </AnimatedPage>
            }
          />
          <Route
            path="/auth"
            element={
              <AnimatedPage>
                {!isSignedIn ? <AuthPage /> : <Navigate to={"/"} replace />}
              </AnimatedPage>
            }
          />
          <Route
            path="/call/:id"
            element={
              <AnimatedPage>
                {isSignedIn ? <CallPage /> : <Navigate to={"/auth"} replace />}
              </AnimatedPage>
            }
          />
          <Route
            path="*"
            element={
              <AnimatedPage>
                {isSignedIn ? (
                  <Navigate to={"/"} replace />
                ) : (
                  <Navigate to={"/auth"} replace />
                )}
              </AnimatedPage>
            }
          />
        </SentryRoutes>
      </AnimatePresence>
    </Suspense>
  );
};

export default App;
