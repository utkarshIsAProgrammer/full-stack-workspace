import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}) => {
  const baseClasses = 'bg-zinc-200 dark:bg-zinc-800';
  
  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: '',
    rounded: 'rounded-lg',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
      role="status"
      aria-label="Loading..."
    />
  );
};

// Post skeleton
export const PostSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-4 shadow-sm">
    <div className="flex items-center gap-3 mb-4">
      <Skeleton variant="circular" width={40} height={40} />
      <div className="flex-1 space-y-2">
        <Skeleton width="60%" height={16} />
        <Skeleton width="40%" height={12} />
      </div>
    </div>
    <Skeleton height={200} className="mb-4 rounded-xl" />
    <div className="space-y-2 mb-4">
      <Skeleton width="90%" height={14} />
      <Skeleton width="70%" height={14} />
    </div>
    <div className="flex items-center justify-between">
      <div className="flex gap-4">
        <Skeleton variant="circular" width={24} height={24} />
        <Skeleton variant="circular" width={24} height={24} />
        <Skeleton variant="circular" width={24} height={24} />
      </div>
      <Skeleton variant="circular" width={24} height={24} />
    </div>
  </div>
);

// Feed skeleton (multiple posts)
export const FeedSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <PostSkeleton key={i} />
    ))}
  </>
);

// User profile skeleton
export const UserProfileSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <Skeleton variant="circular" width={100} height={100} />
        <div className="flex-1 space-y-3">
          <Skeleton width="50%" height={24} />
          <Skeleton width="70%" height={16} />
          <div className="flex gap-6 pt-2">
            <div className="text-center">
              <Skeleton width={40} height={20} />
              <Skeleton width={20} height={12} className="mt-1" />
            </div>
            <div className="text-center">
              <Skeleton width={40} height={20} />
              <Skeleton width={20} height={12} className="mt-1" />
            </div>
            <div className="text-center">
              <Skeleton width={40} height={20} />
              <Skeleton width={20} height={12} className="mt-1" />
            </div>
          </div>
        </div>
      </div>
    </div>
    <Skeleton height={150} className="rounded-2xl" />
  </div>
);

// Comment skeleton
export const CommentSkeleton: React.FC = () => (
  <div className="flex gap-3 p-3">
    <Skeleton variant="circular" width={32} height={32} />
    <div className="flex-1 space-y-2">
      <Skeleton width="30%" height={14} />
      <Skeleton width="80%" height={14} />
      <Skeleton width="60%" height={14} />
    </div>
  </div>
);

// Notification skeleton
export const NotificationSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 p-4 border-b border-zinc-100 dark:border-zinc-800">
    <Skeleton variant="circular" width={40} height={40} />
    <div className="flex-1 space-y-2">
      <Skeleton width="70%" height={14} />
      <Skeleton width="40%" height={12} />
    </div>
    <Skeleton width={50} height={12} />
  </div>
);

// Chat skeleton
export const ChatSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 p-4 border-b border-zinc-100 dark:border-zinc-800">
    <Skeleton variant="circular" width={48} height={48} />
    <div className="flex-1 space-y-2">
      <Skeleton width="40%" height={16} />
      <Skeleton width="60%" height={12} />
    </div>
    <Skeleton width={30} height={12} />
  </div>
);
