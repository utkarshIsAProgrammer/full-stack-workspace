import { User } from "lucide-react";

interface UserAvatarProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string | null;
}

export default function UserAvatar({ src, alt, className = "", ...props }: UserAvatarProps) {
  if (src) {
    return <img src={src} alt={alt || ""} loading="lazy" className={className} {...props} />;
  }

  return (
    <div
      className={`${className} flex items-center justify-center bg-zinc-800`}
      aria-label={alt || "User avatar"}
      {...(props as any)}
    >
      <User className="h-1/2 w-1/2 text-zinc-400" />
    </div>
  );
}
