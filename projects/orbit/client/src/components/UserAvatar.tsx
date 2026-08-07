import React, { useState, useEffect } from "react";
import { User } from "lucide-react";
import { optimizeImageUrl } from "../utils/imageUrls";

interface UserAvatarProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string | null;
  /** Max pixel width requested from Cloudinary (default 96). */
  size?: number;
}

export default function UserAvatar({ src, alt, className = "", size = 96, ...props }: UserAvatarProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  // Avatars are tiny — request a downscaled, format-optimized thumbnail from
  // Cloudinary and load it eagerly so profile pics appear instantly after a
  // reload instead of trickling in at full original resolution.
  const optimizedSrc = optimizeImageUrl(src, size);

  const cleanedClass = className.replace(/\brounded\b(-\S+)?/g, "");
  const baseClass = "rounded-full object-cover shrink-0 aspect-square overflow-hidden";
  const finalClass = `${baseClass} ${cleanedClass}`.trim();

  if (optimizedSrc && !hasError) {
    return (
      <img
        src={optimizedSrc}
        alt={alt || ""}
        loading="lazy"
        decoding="async"
        className={`${finalClass} cursor-pointer`}
        onError={() => setHasError(true)}
        onClick={(e) => {
          e.stopPropagation();
          window.dispatchEvent(new CustomEvent("openImagePreview", { detail: src }));
        }}
        {...props}
      />
    );
  }

  return (
    <div
      className={`${finalClass} flex items-center justify-center bg-zinc-800`}
      aria-label={alt || "User avatar"}
      {...(props as any)}
    >
      <User className="h-1/2 w-1/2 text-zinc-400" />
    </div>
  );
}
