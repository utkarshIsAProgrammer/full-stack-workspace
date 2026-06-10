import React, { useState, useRef, useEffect } from 'react';

interface ProgressiveImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
}

export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  alt,
  className = '',
  placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E',
  width,
  height,
  loading = 'lazy',
}) => {
  const [imgSrc, setImgSrc] = useState(placeholder);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      setImgSrc(src);
      setIsLoaded(true);
    };
    img.onerror = () => {
      setImgSrc(src);
      setIsLoaded(true);
    };
  }, [src]);

  return (
    <img
      ref={imgRef}
      src={imgSrc}
      alt={alt}
      className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-50 blur-sm'} ${className}`}
      style={{
        filter: isLoaded ? 'none' : 'blur(10px)',
        transition: 'filter 0.3s ease-in-out, opacity 0.3s ease-in-out',
      }}
      loading={loading}
      width={width}
      height={height}
    />
  );
};

// Blur-up image component with low-quality placeholder
export const BlurUpImage: React.FC<{
  src: string;
  lowQualitySrc?: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
}> = ({ src, lowQualitySrc, alt, className, width, height }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [showHighRes, setShowHighRes] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      setShowHighRes(true);
      setTimeout(() => setIsLoaded(true), 100);
    };
  }, [src]);

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width, height }}>
      <img
        src={lowQualitySrc || src}
        alt={alt}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
          showHighRes ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ filter: 'blur(20px)' }}
      />
      <img
        src={src}
        alt={alt}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        loading="lazy"
      />
    </div>
  );
};
