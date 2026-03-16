import { useCallback, useMemo, useRef, useState } from "react";
import { NotificationsContext } from "./notificationsContext";
import "./notifications.css";

function createId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function NotificationsProvider({ children }) {
  const [items, setItems] = useState([]);
  const timersRef = useRef(new Map());

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    const t = timersRef.current.get(id);
    if (t) {
      clearTimeout(t);
      timersRef.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    (message, options = {}) => {
      const id = createId();
      const type = options.type || "info";
      const durationMs = Number.isFinite(options.durationMs) ? options.durationMs : 4000;

      setItems((prev) => [{ id, type, message: String(message || "") }, ...prev].slice(0, 5));

      if (durationMs > 0) {
        const t = setTimeout(() => remove(id), durationMs);
        timersRef.current.set(id, t);
      }

      return id;
    },
    [remove],
  );

  const api = useMemo(
    () => ({
      notify,
      success: (msg, opts) => notify(msg, { ...opts, type: "success" }),
      error: (msg, opts) => notify(msg, { ...opts, type: "error" }),
      info: (msg, opts) => notify(msg, { ...opts, type: "info" }),
      remove,
    }),
    [notify, remove],
  );

  return (
    <NotificationsContext.Provider value={api}>
      {children}
      <div className="notifications" aria-live="polite" aria-relevant="additions">
        {items.map((n) => (
          <div key={n.id} className="notice" role="status">
            <div className={`noticeIcon ${n.type}`} />
            <div className="noticeMsg">{n.message}</div>
            <button className="noticeClose" type="button" onClick={() => remove(n.id)} aria-label="Close">
              ×
            </button>
          </div>
        ))}
      </div>
    </NotificationsContext.Provider>
  );
}

