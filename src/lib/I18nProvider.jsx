import { useCallback, useEffect, useMemo, useState } from "react";
import { getPreferredLang, setLang as persistLang, t as translate } from "./i18n";
import { applyTheme } from "./theme";
import { I18nContext } from "./I18nContext";

export default function I18nProvider({ children }) {
  const [lang, setLangState] = useState("en");

  useEffect(() => {
    try {
      setLangState(getPreferredLang());
    } catch {
      setLangState("en");
    }
  }, []);

  const setLang = useCallback((nextLang) => {
    const finalLang = persistLang(nextLang);
    setLangState(finalLang);
    return finalLang;
  }, []);

  const toggleLang = useCallback(() => {
    return setLang(lang === "en" ? "vi" : "en");
  }, [lang, setLang]);

  const t = useCallback((key) => translate(lang, key), [lang]);

  useEffect(() => {
    const onThemeChange = () => {
      const theme = document.documentElement.dataset.theme;
      if (theme) applyTheme(theme);
    };
    window.addEventListener("themechange", onThemeChange);
    return () => window.removeEventListener("themechange", onThemeChange);
  }, []);

  const value = useMemo(() => ({ lang, setLang, toggleLang, t }), [lang, setLang, toggleLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

