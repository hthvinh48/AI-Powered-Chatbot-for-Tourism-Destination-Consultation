const STORAGE_KEY = "travel_planner_lang";

export const LANGS = ["en", "vi"];

const DICT = {
  en: {
    "nav.sign_in": "Sign in",
    "nav.sign_up": "Sign up",
    "menu.dashboard": "DASHBOARD",
    "menu.create_chat": "Create a new Chat",
    "menu.admin": "Admin",
    "menu.explore": "Explore TrAveI",
    "menu.contact": "Contact",
    "menu.recents": "RECENTS",
    "dashboard.create_trip": "Create New Trip",
    "dashboard.inspire": "Inspire me where to go",
    "dashboard.ask_placeholder": "Ask me anything...",
    "under_dev.title": "Under development",
    "under_dev.text": "This page is under development. Please come back later.",
    "under_dev.home": "Go home",
    "under_dev.dashboard": "Go to Dashboard",
    "admin.forbidden_title": "Forbidden",
    "admin.forbidden_text": "You need ADMIN/SUPER_ADMIN role to access this area.",
    "admin.users": "Users",
    "admin.tokens": "Token usage",
    "admin.back": "Back to app",
    "admin.refresh": "Refresh",
    "admin.apply": "Apply",
    "admin.saving": "Saving...",
    "admin.no_role_perm": "No role permission",
    "admin.role_policy": "Role policy: only SUPER_ADMIN can set ADMIN/SUPER_ADMIN.",
    "admin.confirm_role": "Confirm changing role for",
    "admin.updated_role": "Role updated successfully.",
  },
  vi: {
    "nav.sign_in": "Đăng nhập",
    "nav.sign_up": "Đăng ký",
    "menu.dashboard": "BẢNG ĐIỀU KHIỂN",
    "menu.create_chat": "Tạo cuộc chat mới",
    "menu.admin": "Quản trị",
    "menu.explore": "Khám phá TrAveI",
    "menu.contact": "Liên hệ",
    "menu.recents": "GẦN ĐÂY",
    "dashboard.create_trip": "Tạo chuyến đi mới",
    "dashboard.inspire": "Gợi ý điểm đến cho tôi",
    "dashboard.ask_placeholder": "Hỏi bất kỳ điều gì...",
    "under_dev.title": "Đang phát triển",
    "under_dev.text": "Trang này đang được phát triển. Vui lòng quay lại sau.",
    "under_dev.home": "Về trang chủ",
    "under_dev.dashboard": "Tới Dashboard",
    "admin.forbidden_title": "Không có quyền",
    "admin.forbidden_text": "Bạn cần quyền ADMIN/SUPER_ADMIN để truy cập.",
    "admin.users": "Tài khoản",
    "admin.tokens": "Token đã dùng",
    "admin.back": "Về ứng dụng",
    "admin.refresh": "Làm mới",
    "admin.apply": "Áp dụng",
    "admin.saving": "Đang lưu...",
    "admin.no_role_perm": "Không có quyền chỉnh role",
    "admin.role_policy": "Chỉ SUPER_ADMIN mới có thể set ADMIN/SUPER_ADMIN.",
    "admin.confirm_role": "Xác nhận đổi role cho",
    "admin.updated_role": "Cập nhật role thành công.",
  },
};

export function getPreferredLang() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "vi") return stored;
  const nav = (navigator.language || "").toLowerCase();
  return nav.startsWith("vi") ? "vi" : "en";
}

export function setLang(lang) {
  const finalLang = lang === "vi" ? "vi" : "en";
  localStorage.setItem(STORAGE_KEY, finalLang);
  window.dispatchEvent(new Event("langchange"));
  return finalLang;
}

export function t(lang, key) {
  const bundle = DICT[lang] || DICT.en;
  return bundle[key] || DICT.en[key] || key;
}

