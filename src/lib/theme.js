const STORAGE_KEY = "travel_planner_theme";

export function getPreferredTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  return prefersDark ? "dark" : "light";
}

export function applyTheme(theme) {
  const finalTheme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = finalTheme;
  document.documentElement.dataset.bsTheme = finalTheme;
  return finalTheme;
}

export function setTheme(theme) {
  const finalTheme = applyTheme(theme);
  localStorage.setItem(STORAGE_KEY, finalTheme);
  window.dispatchEvent(new Event("themechange"));
  return finalTheme;
}

export function toggleTheme() {
  const current = document.documentElement.dataset.theme || "dark";
  return setTheme(current === "dark" ? "light" : "dark");
}

export function initTheme() {
  try {
    applyTheme(getPreferredTheme());
  } catch {
    // ignore
  }
}

