import { useAuthStore } from "@/stores/authStore";
import type { ApiEnvelope } from "@/types";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

let refreshPromise: Promise<string | null> | null = null;

/** Single-flight refresh; concurrent 401s share one /auth/refresh call. */
async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
        if (!res.ok) return null;
        const body = (await res.json()) as ApiEnvelope<{ accessToken: string; user: never }>;
        useAuthStore.getState().setAccessToken(body.data.accessToken);
        return body.data.accessToken;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
}

export async function api<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? (options.body !== undefined || options.formData ? "POST" : "GET"),
    headers,
    credentials: "include",
    signal: options.signal,
    body: options.formData ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
  });

  if (res.status === 401 && !retried && !path.startsWith("/auth/")) {
    const newToken = await refreshAccessToken();
    if (newToken) return api<T>(path, options, true);
    useAuthStore.getState().logout();
  }

  const text = await res.text();
  const body = (text ? JSON.parse(text) : { success: res.ok, data: null }) as ApiEnvelope<T>;

  if (!res.ok || !body.success) {
    throw new ApiRequestError(
      res.status,
      body.error?.code ?? "ERROR",
      body.error?.message ?? `Request failed (${res.status})`,
      body.error?.details
    );
  }
  return body.data;
}

export { refreshAccessToken, API_URL };
