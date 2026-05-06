export const CHATS_CHANGED_EVENT = "chats:changed";

export function emitChatsChanged(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHATS_CHANGED_EVENT, { detail }));
}
