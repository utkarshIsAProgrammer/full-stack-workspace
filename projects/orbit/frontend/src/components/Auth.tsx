import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Lock,
  User,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Camera,
  Eye,
  EyeOff,
} from "lucide-react";
import { User as UserType } from "../types";
import GlassCard from "./GlassCard";
import ShinyText from "./ShinyText";
import ValidationMessage from "./ValidationMessage";
import CharCounter from "./CharCounter";
import { apiFetch } from "../utils/api";
import { validateSignup, validateLogin } from "../utils/validation";

interface AuthProps {
  onAuthSuccess: (user: UserType, token?: string) => void;
  onForgotPasswordClick: () => void;
}

export default function Auth({
  onAuthSuccess,
  onForgotPasswordClick,
}: AuthProps) {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Common Fields
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Field-level validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // Login identity (username or mail)
  const [identity, setIdentity] = useState("");

  // Signup fields
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [gender] = useState<"male" | "female" | "others">("others");
  const [bio, setBio] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Media files uploads for settings
  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [profilePicPreview, setProfilePicPreview] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState("");

  // Sign up Form Submit
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateSignup({
      username,
      fullName,
      email,
      password,
      confirmPassword,
      bio,
    });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError(null);
      return;
    }
    setFieldErrors({});

    setError(null);
    setLoading(true);

    const formData = new FormData();
    formData.append("username", username.toLowerCase().trim());
    formData.append("fullName", fullName.trim());
    formData.append("email", email.toLowerCase().trim());
    formData.append("password", password);
    formData.append("confirmPassword", confirmPassword);
    formData.append("gender", gender);
    if (bio) formData.append("bio", bio.trim());

    if (profilePicFile) {
      formData.append("profilePic", profilePicFile);
    }
    if (bannerFile) {
      formData.append("bannerImage", bannerFile);
    }

    try {
      const res = await apiFetch("/api/auth/signup", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok && data.success) {
        onAuthSuccess(data.user, data.token);
      } else {
        setError(data.message || "Registration failed.");
      }
    } catch (err) {
      setError("Failed to register profile. Server is currently offline.");
    } finally {
      setLoading(false);
    }
  };

  // Login Form Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateLogin({ usernameOrEmail: identity, password });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError(null);
      return;
    }
    setFieldErrors({});

    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernameOrEmail: identity.trim(), password }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        onAuthSuccess(data.user, data.token);
      } else {
        setError(data.message || "Invalid username or password.");
      }
    } catch (err) {
      setError("Connection failure to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex w-full flex-col items-center">
      {/* Brand Identity Constellation Ring */}
      <div className="mb-6 text-center select-none">
        <div className="relative inline-block">
          <div className="absolute -inset-1 rounded-full bg-linear-to-r from-zinc-200 to-zinc-400 dark:from-zinc-800 dark:to-zinc-600 blur opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
          <h1 className="relative mt-3.5 font-sans text-3xl font-black tracking-[0.25em] text-black dark:text-white uppercase">
            <ShinyText text="ORBIT" speed={3.5} />
          </h1>
        </div>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-extrabold uppercase tracking-[0.25em] mt-2.5 font-sans">
          simple social circle
        </p>
      </div>

      <GlassCard className="w-full max-w-md border-white/10 p-8 shadow-[0_25px_65px_-15px_rgba(0,0,0,0.85)] hover:border-white/20 transition-all duration-300 rounded-4xl">
        {/* Informative Header Title inside card */}
        <div className="mb-6 text-center">
          <h2 className="text-xl font-normal tracking-wide text-white font-display">
            {tab === "login" ? "Welcome Back!" : "Join Orbit Today!"}
          </h2>
          <p className="text-[10px] text-zinc-400 mt-1 uppercase tracking-wider font-mono">
            {tab === "login"
              ? "Sign in to see latest updates from friends"
              : "Create a simple account to post and share moments"}
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2.5 rounded-2xl border border-red-950/30 bg-red-950/20 p-3.5 text-xs text-red-400 font-sans">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={tab === "login" ? handleLoginSubmit : handleSignupSubmit} noValidate className="space-y-5">
          <AnimatePresence mode="wait">
            {tab === "login" ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 font-sans"
              >
                <div className="space-y-2 text-left">
                  <label htmlFor="login-identity" className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 pl-4">Username or Email</label>
                  <div className="relative group">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-5 text-zinc-400 group-focus-within:text-black dark:group-focus-within:text-white transition-colors">
                      <User className="h-4.5 w-4.5" />
                    </span>
                    <input
                      id="login-identity"
                      type="text"
                      required
                      placeholder="alice@gmail.com"
                      value={identity}
                      onChange={(e) => { setIdentity(e.target.value); clearFieldError("identity"); }}
                      className="w-full rounded-full border border-zinc-800 bg-zinc-950/20 py-3.5 pl-12 pr-5 text-sm font-medium text-black dark:text-white placeholder-zinc-400 dark:placeholder-zinc-650 transition-all focus:border-zinc-500 dark:focus:border-white focus:bg-white dark:focus:bg-black focus:outline-none focus:ring-1 focus:ring-black/10 dark:focus:ring-white/10"
                    />
                  </div>
                  <ValidationMessage message={fieldErrors.identity} />
                </div>

                <div className="space-y-2 text-left">
                  <div className="flex items-center justify-between pl-4">
                    <label htmlFor="login-password" className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Password</label>
                    <button
                      type="button"
                      onClick={onForgotPasswordClick}
                      className="text-xs font-bold text-zinc-400 dark:text-zinc-400 hover:text-white dark:hover:text-zinc-200 transition-colors focus:outline-none cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative group">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-5 text-zinc-400 group-focus-within:text-black dark:group-focus-within:text-white transition-colors">
                      <Lock className="h-4.5 w-4.5" />
                    </span>
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); clearFieldError("password"); }}
                      className="w-full rounded-full border border-zinc-800 bg-zinc-950/20 py-3.5 pl-12 pr-12 text-sm font-medium text-black dark:text-white placeholder-zinc-400 dark:placeholder-zinc-650 transition-all focus:border-zinc-500 dark:focus:border-white focus:bg-white dark:focus:bg-black focus:outline-none focus:ring-1 focus:ring-black/10 dark:focus:ring-white/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-5 text-zinc-400 dark:text-zinc-500 hover:text-black dark:hover:text-white cursor-pointer transition-colors"
                    >
                      {showPassword ? <Eye className="h-4.5 w-4.5" /> : <EyeOff className="h-4.5 w-4.5" />}
                    </button>
                  </div>
                  <ValidationMessage message={fieldErrors.password} />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-black py-4 text-xs font-bold tracking-widest uppercase text-white dark:bg-white dark:text-black shadow-md transition-all hover:bg-zinc-900 dark:hover:bg-zinc-100 hover:shadow-lg focus:outline-none disabled:opacity-40 cursor-pointer"
                >
                  {loading ? "Signing In..." : "Sign In"}
                  <ArrowRight className="h-4 w-4" />
                </button>

                <div className="mt-6 text-center text-xs text-zinc-400 font-sans">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => { setTab("signup"); setError(null); setFieldErrors({}); }}
                    className="text-white hover:text-cyan-400 font-semibold underline underline-offset-4 pl-1 hover:scale-102 transition-all cursor-pointer bg-transparent border-0 outline-none"
                  >
                    Create Account
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="signup"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 max-h-[52vh] overflow-y-auto pr-1 font-sans scrollbar-thin"
              >
                {/* Image upload boxes */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-center flex flex-col items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      Profile Photo
                    </span>
                    <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-zinc-800 bg-zinc-950/20 hover:bg-zinc-900/50 hover:border-zinc-600 transition-all duration-300 shadow-sm cursor-pointer group overflow-hidden">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setProfilePicFile(file);
                            setProfilePicPreview(URL.createObjectURL(file));
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      />
                      {profilePicPreview ? (
                        <img loading="lazy"
                          src={profilePicPreview}
                          className="h-full w-full rounded-full object-cover"
                          alt="preview"
                        />
                      ) : (
                        <div className="text-center space-y-1 select-none pointer-events-none">
                          <Camera className="mx-auto h-5 w-5 text-zinc-400 group-hover:text-black dark:group-hover:text-white transition-colors" />
                          <span className="text-[9px] font-bold text-zinc-500 block uppercase tracking-wider">Select Image</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-center flex flex-col items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      Banner Image
                    </span>
                    <div className="relative flex h-24 w-full items-center justify-center rounded-full border-2 border-dashed border-zinc-800 bg-zinc-950/20 hover:bg-zinc-900/50 hover:border-zinc-600 transition-all duration-300 shadow-sm cursor-pointer group overflow-hidden">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setBannerFile(file);
                            setBannerPreview(URL.createObjectURL(file));
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      />
                      {bannerPreview ? (
                        <img loading="lazy"
                          src={bannerPreview}
                          className="h-full w-full rounded-full object-cover"
                          alt="preview"
                        />
                      ) : (
                        <div className="text-center space-y-1 select-none pointer-events-none">
                          <Camera className="mx-auto h-5 w-5 text-zinc-400 group-hover:text-black dark:group-hover:text-white transition-colors" />
                          <span className="text-[9px] font-bold text-zinc-500 block uppercase tracking-wider">Select Image</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <label htmlFor="signup-username" className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 pl-4">Username</label>
                  <input
                    id="signup-username"
                    type="text"
                    required
                    placeholder="alice"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value.toLowerCase().replace(/\s+/g, "")); clearFieldError("username"); }}
                    maxLength={100}
                    className="w-full rounded-full border border-zinc-800 bg-zinc-950/20 py-3.5 px-5 text-sm font-medium text-black dark:text-white placeholder-zinc-400 dark:placeholder-zinc-650 focus:outline-none focus:border-zinc-500 dark:focus:border-white focus:bg-white dark:focus:bg-black focus:ring-1 focus:ring-black/10 dark:focus:ring-white/10 transition-all"
                  />
                  <div className="flex items-center justify-between px-1">
                    <ValidationMessage message={fieldErrors.username} />
                    <CharCounter current={username.length} max={100} />
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <label htmlFor="signup-fullname" className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 pl-4">Full Name</label>
                  <input
                    id="signup-fullname"
                    type="text"
                    required
                    placeholder="Alice Smith"
                    value={fullName}
                    onChange={(e) => { setFullName(e.target.value); clearFieldError("fullName"); }}
                    maxLength={50}
                    className="w-full rounded-full border border-zinc-800 bg-zinc-950/20 py-3.5 px-5 text-sm font-medium text-black dark:text-white placeholder-zinc-400 dark:placeholder-zinc-650 focus:outline-none focus:border-zinc-500 dark:focus:border-white focus:bg-white dark:focus:bg-black focus:ring-1 focus:ring-black/10 dark:focus:ring-white/10 transition-all"
                  />
                  <div className="flex items-center justify-between px-1">
                    <ValidationMessage message={fieldErrors.fullName} />
                    <CharCounter current={fullName.length} max={50} />
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <label htmlFor="signup-email" className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 pl-4">Email Address</label>
                  <input
                    id="signup-email"
                    type="email"
                    required
                    placeholder="alice@gmail.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
                    className="w-full rounded-full border border-zinc-800 bg-zinc-950/20 py-3.5 px-5 text-sm font-medium text-black dark:text-white placeholder-zinc-400 dark:placeholder-zinc-650 focus:outline-none focus:border-zinc-500 dark:focus:border-white focus:bg-white dark:focus:bg-black focus:ring-1 focus:ring-black/10 dark:focus:ring-white/10 transition-all"
                  />
                  <ValidationMessage message={fieldErrors.email} />
                </div>

                <div className="space-y-1.5 text-left">
                  <label htmlFor="signup-password" className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 pl-4">Password</label>
                  <div className="relative">
                    <input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); clearFieldError("password"); }}
                      className="w-full rounded-full border border-zinc-800 bg-zinc-950/20 py-3.5 pl-5 pr-12 text-sm font-medium text-black dark:text-white placeholder-zinc-400 dark:placeholder-zinc-650 focus:outline-none focus:border-zinc-500 dark:focus:border-white focus:bg-white dark:focus:bg-black focus:ring-1 focus:ring-black/10 dark:focus:ring-white/10 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-5 text-zinc-400 hover:text-black dark:hover:text-white cursor-pointer"
                    >
                      {showPassword ? <Eye className="h-4.5 w-4.5" /> : <EyeOff className="h-4.5 w-4.5" />}
                    </button>
                  </div>
                  <ValidationMessage message={fieldErrors.password} />
                </div>

                <div className="space-y-1.5 text-left">
                  <label htmlFor="signup-confirm-password" className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 pl-4">Confirm Password</label>
                  <div className="relative">
                    <input
                      id="signup-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      placeholder="••••••••••••"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError("confirmPassword"); }}
                      className="w-full rounded-full border border-zinc-800 bg-zinc-950/20 py-3.5 pl-5 pr-12 text-sm font-medium text-black dark:text-white placeholder-zinc-400 dark:placeholder-zinc-650 focus:outline-none focus:border-zinc-500 dark:focus:border-white focus:bg-white dark:focus:bg-black focus:ring-1 focus:ring-black/10 dark:focus:ring-white/10 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-5 text-zinc-400 hover:text-black dark:hover:text-white cursor-pointer"
                    >
                      {showConfirmPassword ? <Eye className="h-4.5 w-4.5" /> : <EyeOff className="h-4.5 w-4.5" />}
                    </button>
                  </div>
                  <ValidationMessage message={fieldErrors.confirmPassword} />
                </div>

                <div className="space-y-1.5 text-left">
                  <label htmlFor="signup-bio" className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 pl-4">Bio / About</label>
                  <textarea
                    id="signup-bio"
                    rows={2}
                    placeholder="A short snippet about yourself..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={300}
                    className="w-full rounded-3xl border border-zinc-800 bg-zinc-950/20 py-3.5 px-5 text-sm font-medium text-black dark:text-white placeholder-zinc-400 dark:placeholder-zinc-650 focus:outline-none focus:border-zinc-500 dark:focus:border-white focus:bg-white dark:focus:bg-black focus:ring-1 focus:ring-black/10 dark:focus:ring-white/10 transition-all resize-none"
                  />
                  <div className="flex justify-end px-1">
                    <CharCounter current={bio.length} max={300} />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-black py-4 text-xs font-bold tracking-widest uppercase text-white dark:bg-white dark:text-black transition-all hover:bg-zinc-900 dark:hover:bg-zinc-100 active:scale-[0.98] disabled:opacity-40 cursor-pointer shadow-md"
                >
                  {loading ? "Creating Account..." : "Create Account"}
                  <ShieldCheck className="h-4.5 w-4.5" />
                </button>

                <div className="mt-6 text-center text-xs text-zinc-400 font-sans">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => { setTab("login"); setError(null); setFieldErrors({}); }}
                    className="text-white hover:text-cyan-400 font-semibold underline underline-offset-4 pl-1 hover:scale-102 transition-all cursor-pointer bg-transparent border-0 outline-none"
                  >
                    Sign In
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </GlassCard>
    </div>
  );
}
