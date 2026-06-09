"use client";
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { type Lang, type TKey, t as translate, getLang, setLang } from "@/lib/i18n";

type LanguageContextType = {
  lang: Lang;
  changeLang: (l: Lang) => void;
  t: (key: TKey) => string;
};

const LanguageContext = createContext<LanguageContextType>({
  lang: "es",
  changeLang: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");

  useEffect(() => {
    setLangState(getLang());
  }, []);

  const changeLang = useCallback((l: Lang) => {
    setLang(l);
    setLangState(l);
  }, []);

  const t = useCallback((key: TKey) => translate(lang, key), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, changeLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
