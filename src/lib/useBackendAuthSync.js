import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { apiRequest } from "./apiClient";
import {
  BACKEND_AUTH_CHANGED_EVENT,
  clearBackendAuth,
  getBackendAuth,
  setBackendAuth,
} from "./backendAuth";

export function useBackendAuthSync() {
  const { isLoaded, userId, getToken } = useAuth();
  const [state, setState] = useState({ syncing: false, error: "" });
  const [authVersion, setAuthVersion] = useState(0);

  useEffect(() => {
    const onAuthChanged = () => setAuthVersion((v) => v + 1);
    window.addEventListener(BACKEND_AUTH_CHANGED_EVENT, onAuthChanged);
    return () => window.removeEventListener(BACKEND_AUTH_CHANGED_EVENT, onAuthChanged);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    if (!userId) {
      clearBackendAuth();
      setState({ syncing: false, error: "" });
      return;
    }

    const current = getBackendAuth();
    if (current?.clerkUserId === userId && current?.accessToken && current?.refreshToken) {
      setState({ syncing: false, error: "" });
      return;
    }

    let cancelled = false;
    setState({ syncing: true, error: "" });

    (async () => {
      try {
        const clerkToken = await getToken();
        if (!clerkToken) throw new Error("Missing Clerk token");

        const data = await apiRequest("/api/auth/clerk/exchange", {
          method: "POST",
          credentials: "omit",
          headers: { Authorization: `Bearer ${clerkToken}` },
        });

        setBackendAuth({
          clerkUserId: userId,
          accessToken: data?.accessToken,
          refreshToken: data?.refreshToken,
          user: data?.user,
        });

        if (!cancelled) setState({ syncing: false, error: "" });
      } catch (err) {
        if (!cancelled) setState({ syncing: false, error: err?.message || "Backend auth sync failed" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, userId, getToken, authVersion]);

  return state;
}
