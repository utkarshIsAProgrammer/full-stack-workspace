import React, { useState, useEffect } from "react";
import { User } from "lucide-react";

interface UserAvatarProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string | null;
}

export default function UserAvatar({ src, alt, className = "", ...props }: UserAvatarProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const cleanedClass = className.replace(/\brounded\b(-\S+)?/g, "");
  const baseClass = "rounded-full object-cover shrink-0 aspect-square overflow-hidden";
  const finalClass = `${baseClass} ${cleanedClass}`.trim();

  if (src && !hasError) {
    return (
      <img
        src={src}
        alt={alt || ""}
        loading="lazy"
        className={finalClass}
        onError={() => setHasError(true)}
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
