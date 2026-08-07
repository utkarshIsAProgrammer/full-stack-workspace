/**
 * Rewrite a Cloudinary URL into a small, auto-optimized thumbnail.
 *
 * Profile pics and avatars are stored at full original resolution in the DB.
 * Serving those files to a 32–96px avatar wastes bandwidth and makes images
 * pop in slowly after a reload (cold HTTP cache). Appending Cloudinary
 * transformation params makes the CDN serve a downscaled, format-optimized
 * file (WebP/AVIF + auto quality) — often 10–20x smaller.
 *
 * - `w_<width>`: request only the pixels the avatar actually needs
 * - `q_auto`: optimal quality (40–80% bandwidth reduction)
 * - `f_auto`: best format for the browser (WebP/AVIF/JPEG)
 */
export function optimizeImageUrl(url: string | undefined | null, width = 96): string {
  if (!url) return "";
  // Only Cloudinary-hosted files can be re-transformed on the fly.
  if (!url.includes("cloudinary.com")) return url;
  // Animated GIFs: q_auto/f_auto can strip or degrade the animation, so
  // leave them at original resolution.
  if (/\.gif(\.gif)?(\?|$)/i.test(url)) return url;
  // Don't rewrite a URL that already carries a transformation.
  if (url.includes("/image/upload/w_") || url.includes("/image/upload/q_")) {
    return url;
  }
  return url.replace(
    "/image/upload/",
    `/image/upload/w_${width},q_auto,f_auto/`,
  );
}
