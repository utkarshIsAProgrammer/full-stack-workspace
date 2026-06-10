import React, { useState, useRef, useEffect } from "react";
import { Mail, KeyRound, AlertCircle, ArrowLeft, ArrowRight, ShieldCheck, Eye, EyeOff } from "lucide-react";
import GlassCard from "./GlassCard";
import ValidationMessage from "./ValidationMessage";
import { apiFetch } from "../utils/api";
import { validateForgotPasswordRequest, validateForgotPasswordReset } from "../utils/validation";

interface ForgotPasswordProps {
  onBackToLogin: () => void;
  onSuccess: (msg: string) => void;
}

export default function ForgotPassword({
  onBackToLogin,
  onSuccess,
}: ForgotPasswordProps) {
  const [step, setStep] = useState<"request" | "verify">("request");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [timer, setTimer] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<HTMLInputElement[]>([]);

  // Timer Effect
  useEffect(() => {
    if (step !== "verify" || timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [step, timer]);

  // Request Reset OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateForgotPasswordRequest({ email });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch("/api/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok) {
        setFieldErrors({});
        setStep("verify");
        setTimer(60);
      } else {
        setError(data.message || "Email check failed.");
      }
    } catch (err) {
      setError("Server connection issue.");
    } finally {
      setLoading(false);
    }
  };

  // OTP Inputs handling
  const handleOtpChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = "";
      setOtp(newOtp);
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Complete Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateForgotPasswordReset({ otp, newPassword });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError(null);
      return;
    }
    setFieldErrors({});

    const otpValue = otp.join("");
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch("/api/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          otp: otpValue,
          newPassword,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        onSuccess("Your password was updated! Please authenticate with your new credentials.");
        onBackToLogin();
      } else {
        setError(data.message || "Reset verification failed.");
      }
    } catch (err) {
      setError("Connection failure.");
    } finally {
      setLoading(false);
    }
  };

  const codeResend = async () => {
    if (timer > 0) return;
    setOtp(Array(6).fill(""));
    setTimer(60);
    setError(null);
    try {
      const res = await apiFetch("/api/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        setError("Failed to resend code.");
        return;
      }
    } catch (e) {
      setError("Failed to resend code.");
      return;
    }
  };

  return (
    <GlassCard className="w-full max-w-md border-zinc-800 p-8 shadow-2xl rounded-3xl">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBackToLogin}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer"
        >
          <ArrowLeft className="h-4.5 w-4.5" /> Back to Sign In
        </button>
        <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-black dark:text-white">
          <ShieldCheck className="h-3.5 w-3.5" /> SECURITY
        </span>
      </div>

      <div className="mb-8">
        <h2 className="font-sans text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 md:text-3xl">
          {step === "request" ? "Forgot Password" : "Verify Code"}
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
          {step === "request"
            ? "We'll send a 6-digit verification code to your email."
            : `Enter the code sent to ${email} and enter your new password.`}
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2.5 rounded-3xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/25 p-3.5 text-xs text-red-800 dark:text-red-400">
          <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-600 dark:text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {step === "request" ? (
        <form onSubmit={handleRequestOtp} noValidate className="space-y-5">
          <div className="space-y-1.5 pl-2">
            <label htmlFor="forgot-email" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-350 pl-3">Your Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4.5 text-slate-400 dark:text-zinc-500">
                <Mail className="h-4.5 w-4.5" />
              </span>
              <input
                id="forgot-email"
                type="email"
                required
                placeholder="alice@gmail.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
                className="w-full rounded-full border border-zinc-800 bg-zinc-950/40 py-3.5 pl-12 pr-5 text-sm font-medium text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 transition-all focus:border-black dark:focus:border-white focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-slate-400/50"
              />
            </div>
            <ValidationMessage message={fieldErrors.email} />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-black dark:bg-white py-4 text-xs font-bold tracking-widest uppercase text-white dark:text-black shadow-md shadow-black/10 cursor-pointer transition-all hover:bg-zinc-800 dark:hover:bg-zinc-200 focus:outline-none disabled:opacity-50"
          >
            {loading ? "Sending Code..." : "Send Verification Code"}{" "}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} noValidate className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="forgot-otp" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-350 pl-3">6-Digit Verification Code</label>
            <div className="flex justify-between gap-2.5">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el!; }}
                  id={index === 0 ? "forgot-otp" : undefined}
                  type="text"
                  maxLength={1}
                  required
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="h-12 w-full rounded-full border border-zinc-800 bg-zinc-950/40 text-center text-lg font-bold text-slate-900 dark:text-zinc-100 focus:border-black dark:focus:border-white focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                />
              ))}
            </div>
            <ValidationMessage message={fieldErrors.otp} />
          </div>

          <div className="space-y-1.5 pl-2">
            <label htmlFor="forgot-new-password" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-350 pl-3">New Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4.5 text-slate-400 dark:text-zinc-500">
                <KeyRound className="h-4.5 w-4.5" />
              </span>
              <input
                id="forgot-new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="••••••••••••"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); clearFieldError("newPassword"); }}
                className="w-full rounded-full border border-zinc-800 bg-zinc-950/40 py-3.5 pl-12 pr-12 text-sm font-medium text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 transition-all focus:border-black dark:focus:border-white focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-slate-400/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-4.5 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                {showPassword ? <Eye className="h-4.5 w-4.5" /> : <EyeOff className="h-4.5 w-4.5" />}
              </button>
            </div>
            <ValidationMessage message={fieldErrors.newPassword} />
          </div>

          <div className="flex items-center justify-between text-xs font-sans px-2">
            <span className="text-slate-500 dark:text-zinc-400">Didn't receive verification code?</span>
            <button
              type="button"
              onClick={codeResend}
              className={`font-semibold cursor-pointer transition-colors ${timer > 0 ? "text-zinc-500/50 cursor-not-allowed" : "text-black dark:text-zinc-200 hover:underline"
                }`}
            >
              {timer > 0 ? `Resend Code (${timer}s)` : "Resend Code"}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-black dark:bg-white py-4 text-xs font-bold tracking-widest uppercase text-white dark:text-black shadow-md shadow-black/10 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all focus:outline-none disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Updating Password..." : "Update Password"}
          </button>
        </form>
      )}
    </GlassCard>
  );
}
