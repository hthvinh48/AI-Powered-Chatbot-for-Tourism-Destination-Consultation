const STORAGE_KEY = "travel_planner_backend_auth";

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
  return value;
}

export function clearBackendAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

