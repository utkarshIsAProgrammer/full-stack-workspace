import { logger } from "../utilities/logger";

interface LinkPreviewData {
  url: string;
  title: string;
  description: string;
  image: string;
  favicon: string;
  siteName: string;
}

const OG_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const cache = new Map<string, { data: LinkPreviewData; expires: number }>();

function isPrivateOrInternalUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return true;
    }

    const hostname = parsed.hostname.toLowerCase();

    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname === "169.254.169.254" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      return true;
    }

    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const octet1 = parseInt(ipv4Match[1]!, 10);
      const octet2 = parseInt(ipv4Match[2]!, 10);

      if (octet1 === 127) return true;
      if (octet1 === 10) return true;
      if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return true;
      if (octet1 === 192 && octet2 === 168) return true;
      if (octet1 === 169 && octet2 === 254) return true;
      if (octet1 === 0) return true;
    }

    return false;
  } catch {
    return true;
  }
}

/**
 * Fetch OG metadata from a URL.
 */
export async function fetchLinkPreview(url: string): Promise<LinkPreviewData | null> {
  try {
    if (isPrivateOrInternalUrl(url)) {
      logger.warn("Blocked SSRF attempt in link preview", { url });
      return null;
    }

    // Check cache first
    const cached = cache.get(url);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Orbit/1.0 (Link Preview Bot)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    const html = await response.text();
    const preview = parseOGMetadata(html, url);

    // Cache the result
    if (preview.title || preview.description || preview.image) {
      cache.set(url, { data: preview, expires: Date.now() + OG_CACHE_TTL });
    }

    return preview;
  } catch (err) {
    logger.warn("Failed to fetch link preview", { url, error: (err as Error).message });
    return null;
  }
}

/**
 * Parse OG metadata from HTML content.
 */
function parseOGMetadata(html: string, originalUrl: string): LinkPreviewData {
  const getMeta = (property: string): string => {
    const patterns = [
      new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
      new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, "i"),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return match[1];
    }
    return "";
  };

  const getTitle = (): string => {
    // Try og:title first
    const og = getMeta("og:title");
    if (og) return og;
    // Try twitter:title
    const tw = getMeta("twitter:title");
    if (tw) return tw;
    // Fallback to <title>
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    return titleMatch?.[1]?.trim() || "";
  };

  const getDescription = (): string => {
    const og = getMeta("og:description");
    if (og) return og;
    const tw = getMeta("twitter:description");
    if (tw) return tw;
    const desc = getMeta("description");
    return desc;
  };

  const getImage = (): string => {
    const og = getMeta("og:image");
    if (og) return makeAbsolute(og, originalUrl);
    const tw = getMeta("twitter:image");
    if (tw) return makeAbsolute(tw, originalUrl);
    // Try to find the first large image
    const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    if (imgMatch?.[1]) return makeAbsolute(imgMatch[1], originalUrl);
    return "";
  };

  const getFavicon = (): string => {
    const iconMatch = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i);
    if (iconMatch?.[1]) return makeAbsolute(iconMatch[1], originalUrl);
    return `${new URL(originalUrl).origin}/favicon.ico`;
  };

  const getSiteName = (): string => {
    const og = getMeta("og:site_name");
    if (og) return og;
    return new URL(originalUrl).hostname.replace("www.", "");
  };

  return {
    url: originalUrl,
    title: getTitle(),
    description: getDescription(),
    image: getImage(),
    favicon: getFavicon(),
    siteName: getSiteName(),
  };
}

/**
 * Make a relative URL absolute.
 */
function makeAbsolute(src: string, base: string): string {
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  if (src.startsWith("//")) return `https:${src}`;
  return new URL(src, base).href;
}
