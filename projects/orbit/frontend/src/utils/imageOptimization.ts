/**
 * Image Optimization Utility
 * 
 * This utility helps optimize images for better performance by:
 * - Generating responsive image URLs with different sizes
 * - Supporting modern formats (WebP, AVIF)
 * - Providing lazy loading attributes
 * - Calculating optimal image sizes based on viewport
 */

interface ImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpg' | 'png';
  fit?: 'cover' | 'contain' | 'fill';
}

/**
 * Generate optimized image URL with Cloudinary transformations
 */
export const getOptimizedImageUrl = (
  url: string,
  options: ImageOptions = {}
): string => {
  if (!url) return '';

  const {
    width = 800,
    height = 600,
    quality = 80,
    format = 'webp',
    fit = 'cover',
  } = options;

  // If it's already a Cloudinary URL, add transformations
  if (url.includes('cloudinary.com')) {
    const transformations = [
      `f_${format}`,
      `q_${quality}`,
      `w_${width}`,
      `h_${height}`,
      `c_${fit}`,
    ].join(',');

    return url.replace('/upload/', `/upload/${transformations}/`);
  }

  // For Unsplash images, add parameters
  if (url.includes('unsplash.com')) {
    const params = new URLSearchParams({
      auto: 'format',
      q: String(quality),
      w: String(width),
      h: String(height),
      fit,
    });
    return `${url}?${params.toString()}`;
  }

  // For other URLs, return as-is
  return url;
};

/**
 * Generate responsive image srcset for different screen sizes
 */
export const getResponsiveSrcSet = (
  url: string,
  baseWidth: number = 800,
  baseHeight: number = 600,
  sizes: number[] = [320, 640, 960, 1280, 1920]
): string => {
  return sizes
    .map((size) => {
      const aspectRatio = baseWidth / baseHeight;
      const height = Math.round(size / aspectRatio);
      const optimizedUrl = getOptimizedImageUrl(url, {
        width: size,
        height,
        quality: size > 1280 ? 75 : 80,
      });
      return `${optimizedUrl} ${size}w`;
    })
    .join(', ');
};

/**
 * Generate sizes attribute for responsive images
 */
export const getResponsiveSizes = (
  breakpoints: { max: number; size: string }[] = [
    { max: 640, size: '100vw' },
    { max: 1024, size: '50vw' },
    { max: Infinity, size: '33vw' },
  ]
): string => {
  return breakpoints
    .map(({ max, size }) => (max === Infinity ? size : `(max-width: ${max}px) ${size}`))
    .join(', ');
};

/**
 * Calculate optimal image size based on container
 */
export const calculateOptimalSize = (
  containerWidth: number,
  containerHeight: number,
  pixelRatio: number = window.devicePixelRatio || 1
): { width: number; height: number } => {
  const width = Math.round(containerWidth * pixelRatio);
  const height = Math.round(containerHeight * pixelRatio);
  
  // Round to nearest 100 for better caching
  return {
    width: Math.ceil(width / 100) * 100,
    height: Math.ceil(height / 100) * 100,
  };
};

/**
 * Check if browser supports WebP format
 */
export const supportsWebP = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const canvas = document.createElement('canvas');
  if (canvas.getContext && canvas.getContext('2d')) {
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }
  return false;
};

/**
 * Check if browser supports AVIF format
 */
export const supportsAVIF = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const canvas = document.createElement('canvas');
  if (canvas.getContext && canvas.getContext('2d')) {
    return canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0;
  }
  return false;
};

/**
 * Get best supported image format
 */
export const getBestFormat = (): 'webp' | 'avif' | 'jpg' => {
  if (supportsAVIF()) return 'avif';
  if (supportsWebP()) return 'webp';
  return 'jpg';
};

/**
 * Generate picture element URLs with multiple formats
 * Returns an object with URLs for different formats to use in a picture element
 */
export const getPictureSources = (
  url: string,
  options: ImageOptions = {}
): { avif: string; webp: string; fallback: string } => {
  return {
    avif: getOptimizedImageUrl(url, { ...options, format: 'avif' }),
    webp: getOptimizedImageUrl(url, { ...options, format: 'webp' }),
    fallback: getOptimizedImageUrl(url, { ...options, format: 'jpg' }),
  };
};
