"use client";
import { LANGUAGES, type Lang } from "@/lib/i18n";

interface Props {
  value: Lang;
  onChange: (lang: Lang) => void;
  label?: string;
}

export default function LanguageSelector({ value, onChange, label }: Props) {
  return (
    <div>
      {label && <p className="text-xs text-gray-400 mb-2">{label}</p>}
      <div className="grid grid-cols-2 gap-2">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => onChange(l.code)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition ${
              value === l.code
                ? "border-hate-red bg-hate-red/10 text-white"
                : "border-gray-700 bg-hate-light text-gray-400 hover:border-gray-500 hover:text-white"
            }`}
          >
            <span className="text-lg leading-none">{l.flag}</span>
            <span>{l.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
