const STORAGE_KEY = "travel_planner_backend_auth";
export const BACKEND_AUTH_CHANGED_EVENT = "backend-auth:changed";

function emitBackendAuthChanged(detail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BACKEND_AUTH_CHANGED_EVENT, { detail }));
}

export function getBackendAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setBackendAuth(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  emitBackendAuthChanged({ type: "set", value });
  return value;
}

export function clearBackendAuth() {
  localStorage.removeItem(STORAGE_KEY);
  emitBackendAuthChanged({ type: "clear" });
}
