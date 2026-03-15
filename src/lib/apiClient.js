const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || "";
const API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");

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

export async function apiRequestBackend(path, options = {}) {
  const { getBackendAuth, setBackendAuth, clearBackendAuth } = await import("./backendAuth.js");
  const stored = getBackendAuth();

  const accessToken = stored?.accessToken || null;
  const refreshToken = stored?.refreshToken || null;

  try {
    return await apiRequest(path, { ...options, token: accessToken });
  } catch (err) {
    if (err?.status !== 401 || !refreshToken) throw err;

    try {
      const refreshed = await apiRequest("/api/auth/refresh", {
        method: "POST",
        credentials: "omit",
        body: { refreshToken },
      });

      setBackendAuth({
        ...stored,
        accessToken: refreshed?.accessToken,
        refreshToken: refreshed?.refreshToken,
      });

      return apiRequest(path, { ...options, token: refreshed?.accessToken });
    } catch (refreshErr) {
      clearBackendAuth();
      throw refreshErr;
    }
  }
}
