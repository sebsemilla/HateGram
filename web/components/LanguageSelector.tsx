"use client";
import { LANGUAGES, type Lang } from "@/lib/i18n";

interface Props {
  value: Lang;
  onChange: (lang: Lang) => void;
  label?: string;
}

export default function LanguageSelector({ value, onChange, label }: Props) {
  const selected = LANGUAGES.find((l) => l.code === value);

  return (
    <div>
      {label && <p className="text-xs text-gray-400 mb-2">{label}</p>}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as Lang)}
          className="w-full appearance-none bg-hate-light border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-hate-red cursor-pointer pr-10"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.flag} {l.name}
            </option>
          ))}
        </select>
        {/* Chevron + selected flag preview */}
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-1.5">
          <span className="text-base leading-none">{selected?.flag}</span>
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
