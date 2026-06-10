import React from "react";
import { motion } from "motion/react";

interface SkeletonProps {
  className?: string;
  variant?: "card" | "avatar" | "text" | "circle" | "banner" | "profile-row" | "message-sent" | "message-received";
  width?: string;
  height?: string;
  count?: number;
}

function SkeletonInner({ className = "", variant = "text", width, height }: SkeletonProps) {
  const baseClass = "relative overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/40 backdrop-blur-sm";
  
  const variantClasses: Record<string, string> = {
    card: "p-5 space-y-4",
    avatar: "rounded-full",
    text: "h-3 rounded-full",
    circle: "rounded-full",
    banner: "h-44 rounded-3xl",
    "profile-row": "flex items-center gap-3 p-4",
    "message-sent": "ml-auto max-w-[75%]",
    "message-received": "mr-auto max-w-[75%]",
  };

  const sizeStyles: React.CSSProperties = {};
  if (width) sizeStyles.width = width;
  if (height) sizeStyles.height = height;

  return (
    <motion.div
      className={`${baseClass} ${variantClasses[variant] || variantClasses.text} ${className}`}
      style={sizeStyles}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Glass shimmer overlay */}
      <div className="absolute inset-0 opacity-30 pointer-events-none bg-[length:200%_100%] bg-linear-to-r from-transparent via-white/5 to-transparent animate-[shimmer_2s_ease-in-out_infinite]" />
      <div className="relative z-10">
        {variant === "card" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-zinc-800/60 animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-3 w-1/3 rounded-full bg-zinc-800/60 animate-pulse" />
                <div className="h-2.5 w-1/5 rounded-full bg-zinc-800/40 animate-pulse" />
              </div>
            </div>
            <div className="h-4 w-3/4 rounded-full bg-zinc-800/50 animate-pulse" />
            <div className="space-y-2">
              <div className="h-3 w-full rounded-full bg-zinc-800/40 animate-pulse" />
              <div className="h-3 w-2/3 rounded-full bg-zinc-800/40 animate-pulse" />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800/30">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-3 w-10 rounded-full bg-zinc-800/40 animate-pulse" />
              ))}
            </div>
          </div>
        )}
        {variant === "profile-row" && (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-zinc-800/60 animate-pulse shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-3 w-1/3 rounded-full bg-zinc-800/60 animate-pulse" />
              <div className="h-2.5 w-1/5 rounded-full bg-zinc-800/40 animate-pulse" />
            </div>
          </div>
        )}
        {variant === "message-sent" && (
          <div className="flex flex-col items-end gap-1.5">
            <div className="rounded-2xl rounded-tr-none bg-zinc-800/60 px-3.5 py-2.5 w-4/5">
              <div className="h-2.5 w-full rounded-full bg-zinc-700/60 animate-pulse" />
              <div className="h-2.5 w-2/3 rounded-full bg-zinc-700/40 animate-pulse mt-2" />
            </div>
          </div>
        )}
        {variant === "message-received" && (
          <div className="flex items-start gap-2.5">
            <div className="h-7 w-7 rounded-full bg-zinc-800/60 animate-pulse shrink-0 mt-1" />
            <div className="rounded-2xl rounded-tl-none bg-zinc-900/60 px-3.5 py-2.5 w-4/5">
              <div className="h-2.5 w-full rounded-full bg-zinc-800/40 animate-pulse" />
              <div className="h-2.5 w-1/2 rounded-full bg-zinc-800/30 animate-pulse mt-2" />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default React.memo(function Skeleton(props: SkeletonProps) {
  const { count = 1, ...rest } = props;
  
  if (count <= 1) {
    return <SkeletonInner {...rest} />;
  }

  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonInner key={i} {...rest} />
      ))}
    </div>
  );
});
