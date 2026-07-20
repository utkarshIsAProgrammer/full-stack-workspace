import React, { useState, useCallback } from "react";
import { motion } from "motion/react";
import {
  X,
  ArrowRight,
  ArrowLeft,
  Check,
  Bell,
  UserPlus,
  MessageSquare,
  Camera,
  Sparkles,
} from "lucide-react";

interface OnboardingStep {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void | Promise<void>;
  };
}

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  steps?: OnboardingStep[];
}

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    icon: <Sparkles className="h-8 w-8" />,
    title: "Welcome to ORBIT",
    description:
      "Your inner circle social network. Share posts, connect with friends, and discover new communities.",
  },
  {
    id: "profile",
    icon: <Camera className="h-8 w-8" />,
    title: "Set Up Your Profile",
    description:
      "Add a profile photo and banner to personalize your space. Let others know who you are.",
    action: {
      label: "Edit Profile",
      onClick: () => {
        window.dispatchEvent(new CustomEvent("onboarding:navigate", { detail: { tab: "settings" } }));
      },
    },
  },
  {
    id: "connect",
    icon: <UserPlus className="h-8 w-8" />,
    title: "Find People to Follow",
    description:
      "Follow interesting people to populate your feed. Check the suggestions sidebar for recommendations.",
    action: {
      label: "Explore Users",
      onClick: () => {
        window.dispatchEvent(new CustomEvent("onboarding:navigate", { detail: { tab: "explore" } }));
      },
    },
  },
  {
    id: "notifications",
    icon: <Bell className="h-8 w-8" />,
    title: "Stay in the Loop",
    description:
      "Enable notifications to never miss likes, comments, and messages from your circle.",
    action: {
      label: "Enable Notifications",
      onClick: async () => {
        if ("Notification" in window) {
          await Notification.requestPermission();
        }
      },
    },
  },
  {
    id: "post",
    icon: <MessageSquare className="h-8 w-8" />,
    title: "Create Your First Post",
    description:
      "Share a thought, photo, or story with your circle. Use hashtags to reach more people!",
    action: {
      label: "Create Post",
      onClick: () => {
        window.dispatchEvent(new CustomEvent("onboarding:navigate", { detail: { tab: "compose" } }));
      },
    },
  },
  {
    id: "complete",
    icon: <Check className="h-8 w-8" />,
    title: "You're All Set!",
    description:
      "You're ready to explore ORBIT. Start connecting, sharing, and discovering.",
  },
];

export default function OnboardingWizard({
  isOpen,
  onClose,
  onComplete,
  steps = DEFAULT_STEPS,
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActionRunning, setIsActionRunning] = useState(false);

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, steps.length]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const handleAction = useCallback(async () => {
    if (!step?.action) return;
    setIsActionRunning(true);
    try {
      await step.action.onClick();
    } finally {
      setIsActionRunning(false);
    }
  }, [step]);

  const handleComplete = useCallback(() => {
    localStorage.setItem("orbit_onboarding_complete", "true");
    onComplete();
    setCurrentStep(0);
  }, [onComplete]);

  const handleClose = useCallback(() => {
    onClose();
    setCurrentStep(0);
  }, [onClose]);

  const progress = ((currentStep + 1) / steps.length) * 100;

  if (!isOpen || !step) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
      />

      <motion.div
        key={step.id}
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -30 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-sm rounded-3xl border border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl p-8 shadow-2xl"
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Progress bar */}
        <div className="mb-6 h-1 w-full rounded-full bg-zinc-800">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        {/* Step indicator */}
        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Step {currentStep + 1} of {steps.length}
        </div>

        {/* Icon */}
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-zinc-700/50 bg-zinc-900 text-zinc-300">
          {step.icon}
        </div>

        {/* Title */}
        <h2 className="mb-2 text-lg font-bold text-white">{step.title}</h2>

        {/* Description */}
        <p className="mb-6 text-sm leading-relaxed text-zinc-400">
          {step.description}
        </p>

        {/* Action button (if any) */}
        {step.action && (
          <button
            onClick={handleAction}
            disabled={isActionRunning}
            className="mb-4 w-full rounded-full bg-white px-5 py-2.5 text-xs font-bold text-black transition-all hover:bg-zinc-200 active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            {step.action.label}
          </button>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={isFirst ? handleClose : handlePrev}
            className="flex items-center gap-1 rounded-full px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            {!isFirst && <ArrowLeft className="h-3.5 w-3.5" />}
            {isFirst ? "Skip" : "Back"}
          </button>

          <button
            onClick={isLast ? handleComplete : handleNext}
            className="flex items-center gap-1 rounded-full bg-zinc-900 px-5 py-2 text-xs font-semibold text-white transition-all hover:bg-zinc-800 active:scale-[0.98] cursor-pointer"
          >
            {isLast ? (
              <>
                Get Started <Sparkles className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Next <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
