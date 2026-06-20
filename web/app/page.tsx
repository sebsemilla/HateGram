"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const hasVisited = localStorage.getItem("has_visited");
    if (token) router.replace("/feed");
    else if (hasVisited) router.replace("/login");
    // Si no tiene token ni ha visitado antes → muestra la landing
  }, [router]);

  return (
    <div className="min-h-screen bg-hate-dark flex flex-col items-center justify-between px-6 py-12 text-white">

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm w-full">
        <h1 className="text-6xl font-black mb-3 bg-gradient-to-r from-cyan-400 to-fuchsia-600 bg-clip-text text-transparent">
          feedpod
        </h1>
        <p className="text-gray-400 text-lg mb-2">La red social sin filtros</p>
        <p className="text-gray-600 text-sm mb-12">Opiná. Debatí. Conectá.</p>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 justify-center mb-12">
          {[
            "🔥 Sin algoritmo corporativo",
            "💬 Debates reales",
            "🌎 Comunidad global",
            "🚀 Beta exclusiva",
          ].map((f) => (
            <span key={f} className="bg-hate-gray border border-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-full">
              {f}
            </span>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/welcome/country"
          className="w-full py-4 rounded-2xl font-black text-lg text-white text-center bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:opacity-90 transition shadow-lg shadow-cyan-500/20"
        >
          Comenzar gratis →
        </Link>
        <Link href="/login" className="mt-4 text-gray-600 hover:text-gray-400 text-sm transition">
          Ya tengo cuenta — Iniciar sesión
        </Link>
      </div>

      {/* Footer */}
      <p className="text-gray-700 text-xs text-center mt-8">
        Beta · v0.1 · Acceso limitado a los primeros 200 usuarios
      </p>
    </div>
  );
}
