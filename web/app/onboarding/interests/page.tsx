"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { onboardingApi } from "@/lib/api";

const INTERESTS = [
  { key: "politica",       label: "Política",        emoji: "🗳️",  desc: "Actualidad, debates, opinión" },
  { key: "deportes",       label: "Deportes",         emoji: "⚽",  desc: "Fútbol, básquet, MMA, eSports" },
  { key: "tecnologia",     label: "Tecnología",       emoji: "💻",  desc: "IA, startups, gadgets, código" },
  { key: "humor",          label: "Humor",            emoji: "😂",  desc: "Memes, humor negro, ironía" },
  { key: "arte",           label: "Arte",             emoji: "🎨",  desc: "Diseño, fotografía, literatura" },
  { key: "ciencia",        label: "Ciencia",          emoji: "🔬",  desc: "Divulgación, investigación, medio ambiente" },
  { key: "lifestyle",      label: "Lifestyle",        emoji: "✈️",  desc: "Moda, viajes, fitness, gastronomía" },
  { key: "entretenimiento",label: "Entretenimiento",  emoji: "🎬",  desc: "Series, música, cine, gaming" },
];

export default function InterestsPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function handleContinue() {
    if (selected.size === 0) { setError("Seleccioná al menos un interés"); return; }
    setError("");
    setLoading(true);
    try {
      await onboardingApi.saveInterests(Array.from(selected));
      router.push("/feed");
    } catch {
      setError("No se pudieron guardar los intereses. Podés hacerlo luego desde tu perfil.");
      setTimeout(() => router.push("/feed"), 2000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-hate-dark flex flex-col items-center px-6 py-10 text-white">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black mb-2 bg-gradient-to-r from-cyan-400 to-fuchsia-600 bg-clip-text text-transparent">
            ¿Qué te interesa?
          </h1>
          <p className="text-gray-500 text-sm">
            Elegí al menos uno. Esto define tu feed y los trending que ves.
          </p>
        </div>

        {/* Interest grid */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {INTERESTS.map((item) => {
            const active = selected.has(item.key);
            return (
              <button
                key={item.key}
                onClick={() => toggle(item.key)}
                className={`relative text-left p-4 rounded-2xl border-2 transition ${
                  active
                    ? "border-cyan-500 bg-cyan-500/10"
                    : "border-gray-700 bg-hate-gray hover:border-gray-500"
                }`}
              >
                {active && (
                  <span className="absolute top-2 right-2 text-cyan-400 text-xs font-black">✓</span>
                )}
                <span className="text-2xl block mb-2">{item.emoji}</span>
                <p className={`font-bold text-sm ${active ? "text-cyan-400" : "text-white"}`}>{item.label}</p>
                <p className="text-gray-500 text-xs mt-0.5 leading-tight">{item.desc}</p>
              </button>
            );
          })}
        </div>

        {selected.size > 0 && (
          <p className="text-center text-gray-600 text-xs mb-4">
            {selected.size} {selected.size === 1 ? "interés seleccionado" : "intereses seleccionados"}
          </p>
        )}

        {error && <p className="text-amber-400 text-xs text-center mb-4">{error}</p>}

        <button
          onClick={handleContinue}
          disabled={selected.size === 0 || loading}
          className="w-full py-4 rounded-2xl font-black text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:opacity-90 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {loading ? "Guardando..." : "Entrar a feedpod →"}
        </button>

        <button
          onClick={() => router.push("/feed")}
          className="w-full mt-3 text-gray-600 hover:text-gray-400 text-sm transition text-center"
        >
          Omitir por ahora
        </button>
      </div>
    </div>
  );
}
