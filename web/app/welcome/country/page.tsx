"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const COUNTRIES = [
  "Argentina", "México", "Colombia", "España", "Chile", "Perú", "Venezuela",
  "Ecuador", "Bolivia", "Uruguay", "Paraguay", "Brasil", "Estados Unidos",
  "Otro",
];

export default function CountryPage() {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");

  const filtered = COUNTRIES.filter((c) =>
    c.toLowerCase().includes(search.toLowerCase())
  );

  function handleContinue() {
    if (!selected) return;
    localStorage.setItem("onboarding_country", selected);
    router.push("/welcome/membership");
  }

  return (
    <div className="min-h-screen bg-hate-dark flex flex-col items-center px-6 py-10 text-white">
      <div className="w-full max-w-sm flex flex-col h-full">

        {/* Progress */}
        <div className="flex gap-1.5 mb-8">
          <div className="h-1 flex-1 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-600" />
          <div className="h-1 flex-1 rounded-full bg-hate-gray" />
          <div className="h-1 flex-1 rounded-full bg-hate-gray" />
        </div>

        <h2 className="text-2xl font-black mb-1">¿De dónde sos?</h2>
        <p className="text-gray-500 text-sm mb-6">Esto nos ayuda a mostrarte contenido relevante de tu región.</p>

        {/* Search */}
        <input
          type="text"
          placeholder="Buscar país..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-hate-gray border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 text-sm mb-3 transition"
        />

        {/* Country list */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-2 mb-6 max-h-72">
          {filtered.map((c) => (
            <button
              key={c}
              onClick={() => setSelected(c)}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition border-2 ${
                selected === c
                  ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                  : "border-transparent bg-hate-gray text-gray-300 hover:border-gray-600"
              }`}
            >
              {selected === c && <span className="mr-2">✓</span>}
              {c}
            </button>
          ))}
        </div>

        <button
          onClick={handleContinue}
          disabled={!selected}
          className="w-full py-4 rounded-2xl font-black text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:opacity-90 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Continuar →
        </button>
      </div>
    </div>
  );
}
