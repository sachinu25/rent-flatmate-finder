/**
 * Browser API client.
 *
 * - Requests go to the same-origin `/api` path (proxied to Express by Next.js).
 * - The access token lives only in memory. The refresh token is an httpOnly
 *   cookie the browser sends to `/api/auth/*` automatically — JavaScript can
 *   never read it, so XSS cannot exfiltrate a long-lived session.
 * - On 401 the client refreshes once (single-flight) and retries.
 */

export interface ApiResponse<T = unknown> {
  status: "success" | "error";
  data?: T;
  message?: string;
  statusCode?: number;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly errors?: Record<string, string[]>;

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }

  /** First message for a field, if the server returned field errors. */
  field(name: string): string | undefined {
    return this.errors?.[name]?.[0];
  }
}

export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof ApiError) {
    const firstField = err.errors && Object.values(err.errors)[0]?.[0];
    return err.message === "Validation failed" && firstField ? firstField : err.message || fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

const API_BASE = "/api";

/**
 * Multipart photo uploads (up to 8 × 5 MB) go straight to the backend instead of
 * through the Vercel rewrite proxy, whose request-size limits are not guaranteed.
 * They authenticate with the bearer token only (no cookies), which the backend's
 * CORS allow-list permits. Falls back to the proxy when no public URL is set.
 */
const PUBLIC_BACKEND = process.env.NEXT_PUBLIC_SOCKET_URL?.replace(/\/$/, "");
const DIRECT_API_BASE = PUBLIC_BACKEND ? `${PUBLIC_BACKEND}/api` : API_BASE;

let accessToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}
export function setSessionExpiredHandler(fn: (() => void) | null) {
  onSessionExpired = fn;
}

export interface RefreshResult {
  accessToken: string;
  user: import("./types").User;
}

let refreshInFlight: Promise<RefreshResult | null> | null = null;

/** Exchange the refresh cookie for a new access token. Single-flight. */
export function refreshSession(): Promise<RefreshResult | null> {
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-Requested-With": "fetch" },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as ApiResponse<RefreshResult>;
      if (!json.data) return null;
      accessToken = json.data.accessToken;
      return json.data;
    } catch {
      return null;
    } finally {
      setTimeout(() => (refreshInFlight = null), 0);
    }
  })();
  return refreshInFlight;
}

async function request<T>(endpoint: string, options: RequestInit = {}, retry = true): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers);
  headers.set("X-Requested-With", "fetch");
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const direct = options.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${direct ? DIRECT_API_BASE : API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: direct ? "omit" : "same-origin",
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError("Network error — check your connection and try again.", 0);
  }

  if (res.status === 401 && retry && accessToken && !endpoint.startsWith("/auth/")) {
    const refreshed = await refreshSession();
    if (refreshed) return request<T>(endpoint, options, false);
    accessToken = null;
    onSessionExpired?.();
  }

  let json: ApiResponse<T>;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(res.ok ? "Unexpected server response" : `Request failed (${res.status})`, res.status);
  }

  if (!res.ok) {
    throw new ApiError(json.message ?? `Request failed (${res.status})`, res.status, json.errors);
  }
  return json;
}

const body = (b: unknown) => (b === undefined ? undefined : b instanceof FormData ? b : JSON.stringify(b));

export const api = {
  get: <T>(endpoint: string, init?: RequestInit) => request<T>(endpoint, init),
  post: <T>(endpoint: string, b?: unknown) => request<T>(endpoint, { method: "POST", body: body(b) }),
  put: <T>(endpoint: string, b?: unknown) => request<T>(endpoint, { method: "PUT", body: body(b) }),
  patch: <T>(endpoint: string, b?: unknown) => request<T>(endpoint, { method: "PATCH", body: body(b) }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: "DELETE" }),
};

/** Build a query string from defined, non-empty values. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
