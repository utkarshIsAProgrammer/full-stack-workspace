// ── Request deduplication store (shares parsed JSON, not raw Response bodies) ──
interface FetchResult {
  ok: boolean;
  status: number;
  data: unknown;
}

const pendingRequests = new Map<string, Promise<FetchResult>>();

function toJsonResponse(result: FetchResult): Response {
  return new Response(JSON.stringify(result.data), {
    status: result.status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Read the CSRF token from the non-httpOnly cookie set by the server.
 */
function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
  return match ? match[1]! : null;
}

export function clearCache(_pattern?: string) {
  // GET caching disabled for realtime accuracy — kept for API compatibility
}

export function invalidateCache(_patterns: string[]) {
  // GET caching disabled — kept for API compatibility
}

export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = options.method || "GET";

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  const token = localStorage.getItem("orbit_jwt_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (method !== "GET") {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers["x-csrf-token"] = csrfToken;
    }

    // Clone Response to prevent "body already consumed" errors from multiple readers
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });
    return res.clone();
  }

  // ── GET: deduplicate in-flight identical requests ─────────────────
  const pending = pendingRequests.get(url);
  if (pending) {
    const result = await pending;
    return toJsonResponse(result);
  }

  const requestPromise = (async (): Promise<FetchResult> => {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    let data: unknown = null;
    if (res.headers.get("content-type")?.includes("application/json")) {
      try {
        data = await res.json();
      } catch {
        data = null;
      }
    }

    return { ok: res.ok, status: res.status, data };
  })();

  pendingRequests.set(url, requestPromise);

  try {
    const result = await requestPromise;
    return toJsonResponse(result);
  } finally {
    pendingRequests.delete(url);
  }
}
