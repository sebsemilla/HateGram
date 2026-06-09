"use client";
import { useState, useEffect, useCallback } from "react";
import { type Lang, type TKey, t as translate, getLang, setLang } from "@/lib/i18n";

export function useLanguage() {
  const [lang, setLangState] = useState<Lang>("es");

  useEffect(() => {
    setLangState(getLang());
  }, []);

  const changeLang = useCallback((l: Lang) => {
    setLang(l);
    setLangState(l);
  }, []);

  const t = useCallback((key: TKey) => translate(lang, key), [lang]);

  return { lang, changeLang, t };
}
