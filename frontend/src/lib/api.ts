/**
 * The access token lives in memory only (a module-level variable), never in
 * localStorage — that avoids exposing it to XSS-injected scripts. The
 * refresh token is an httpOnly cookie the browser sends automatically; we
 * never touch it in JS. On a hard page reload, `bootstrapSession()` (called
 * once from AuthContext) hits /api/auth/refresh with that cookie to get a
 * fresh access token back into memory.
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  // Coalesce concurrent 401s into a single refresh call.
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = await res.json();
        setAccessToken(data.accessToken);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  skipAuthRetry?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const doFetch = async () =>
    fetch(path, {
      method: options.method ?? "GET",
      credentials: "include",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

  let res = await doFetch();

  if (res.status === 401 && !options.skipAuthRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) res = await doFetch();
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.code ?? "UNKNOWN", data?.error?.message ?? "Something went wrong.", data?.error?.details);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PUT", body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};

/** Called once on app load to silently restore a session from the refresh cookie, if any. */
export async function bootstrapSession(): Promise<boolean> {
  return refreshAccessToken();
}
