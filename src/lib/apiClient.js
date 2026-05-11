const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || "";
const API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");

let backendExchangePromise = null;
let backendRefreshPromise = null;

function buildUrl(path) {
  if (!path) throw new Error("Missing path");
  if (/^https?:\/\//i.test(path)) return path;
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

async function readResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response.json();
  return response.text();
}

export async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    body,
    headers,
    token,
    credentials = "include",
    ...rest
  } = options;

  const finalHeaders = new Headers(headers || {});

  if (body !== undefined && body !== null && !finalHeaders.has("Content-Type")) {
    finalHeaders.set("Content-Type", "application/json");
  }

  if (token && !finalHeaders.has("Authorization")) {
    finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path), {
    method,
    headers: finalHeaders,
    body: body === undefined || body === null ? undefined : JSON.stringify(body),
    credentials,
    ...rest,
  });

  const payload = await readResponseBody(response);
  if (!response.ok) {
    const baseMessage =
      (payload && typeof payload === "object" && payload.message) ||
      `Request failed (${response.status})`;

    const detail =
      payload && typeof payload === "object" && payload.detail
        ? String(payload.detail)
        : "";

    const message = detail ? `${baseMessage}: ${detail}` : baseMessage;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export async function pingApi() {
  return apiRequest("/api/health", { method: "GET", credentials: "omit" });
}

async function exchangeBackendAuthFromClerk(stored, setBackendAuth) {
  if (typeof window === "undefined") return null;

  const clerkSession = window?.Clerk?.session;
  const getToken = clerkSession?.getToken;
  if (typeof getToken !== "function") return null;

  const clerkToken = await getToken.call(clerkSession);
  if (!clerkToken) return null;

  const data = await apiRequest("/api/auth/clerk/exchange", {
    method: "POST",
    credentials: "omit",
    headers: { Authorization: `Bearer ${clerkToken}` },
  });

  const next = {
    clerkUserId: stored?.clerkUserId || window?.Clerk?.user?.id || data?.user?.id || null,
    accessToken: data?.accessToken || null,
    refreshToken: data?.refreshToken || null,
    user: data?.user || stored?.user || null,
  };

  if (!next.accessToken || !next.refreshToken) return null;
  setBackendAuth(next);
  return next;
}

function getBackendExchange(stored, setBackendAuth) {
  if (!backendExchangePromise) {
    backendExchangePromise = exchangeBackendAuthFromClerk(stored, setBackendAuth).finally(() => {
      backendExchangePromise = null;
    });
  }
  return backendExchangePromise;
}

function refreshBackendAuth(stored, refreshToken, setBackendAuth) {
  if (!backendRefreshPromise) {
    backendRefreshPromise = apiRequest("/api/auth/refresh", {
      method: "POST",
      credentials: "omit",
      body: { refreshToken },
    })
      .then((refreshed) => {
        const next = {
          ...stored,
          accessToken: refreshed?.accessToken,
          refreshToken: refreshed?.refreshToken,
        };
        setBackendAuth(next);
        return next;
      })
      .finally(() => {
        backendRefreshPromise = null;
      });
  }
  return backendRefreshPromise;
}

export async function apiRequestBackend(path, options = {}) {
  const { getBackendAuth, setBackendAuth, clearBackendAuth } = await import("./backendAuth.js");
  let stored = getBackendAuth();

  let accessToken = stored?.accessToken || null;
  let refreshToken = stored?.refreshToken || null;

  if (!accessToken || !refreshToken) {
    try {
      const exchanged = await getBackendExchange(stored, setBackendAuth);
      if (exchanged) {
        stored = exchanged;
        accessToken = exchanged.accessToken;
        refreshToken = exchanged.refreshToken;
      }
    } catch {
      // Let the request below throw its own auth error when exchange is not available.
    }
  }

  try {
    return await apiRequest(path, { ...options, token: accessToken });
  } catch (err) {
    if (err?.status !== 401) throw err;

    if (!refreshToken) {
      try {
        const exchanged = await getBackendExchange(stored, setBackendAuth);
        if (exchanged?.accessToken) {
          return await apiRequest(path, { ...options, token: exchanged.accessToken });
        }
      } catch {
        // Fall through and throw original unauthorized error.
      }
      throw err;
    }

    try {
      const refreshedAuth = await refreshBackendAuth(stored, refreshToken, setBackendAuth);
      return apiRequest(path, { ...options, token: refreshedAuth?.accessToken });
    } catch (refreshErr) {
      clearBackendAuth();

      try {
        const exchanged = await getBackendExchange(stored, setBackendAuth);
        if (exchanged?.accessToken) {
          return await apiRequest(path, { ...options, token: exchanged.accessToken });
        }
      } catch {
        // Fall through and throw refresh error.
      }

      throw refreshErr;
    }
  }
}
