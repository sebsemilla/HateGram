"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onboardingApi } from "@/lib/api";

type Plan = "beta_free" | "lifetime_pending" | "tester";

export default function MembershipPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Plan>("beta_free");
  const [spots, setSpots] = useState<{ remaining: number; taken: number } | null>(null);

  useEffect(() => {
    onboardingApi.betaSpots().then(setSpots).catch(() => {});
  }, []);

  function handleContinue() {
    localStorage.setItem("onboarding_membership", selected);
    router.push("/register");
  }

  const lifetimeSoldOut = spots !== null && spots.remaining === 0;

  return (
    <div className="min-h-screen bg-hate-dark flex flex-col items-center px-6 py-10 text-white">
      <div className="w-full max-w-sm">

        {/* Progress */}
        <div className="flex gap-1.5 mb-8">
          <div className="h-1 flex-1 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-600" />
          <div className="h-1 flex-1 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-600" />
          <div className="h-1 flex-1 rounded-full bg-hate-gray" />
        </div>

        <h2 className="text-2xl font-black mb-1">Elegí tu plan</h2>
        <p className="text-gray-500 text-sm mb-7">Estamos en beta abierta. Aprovechá las condiciones de lanzamiento.</p>

        <div className="flex flex-col gap-3 mb-8">

          {/* Beta gratis */}
          <button
            onClick={() => setSelected("beta_free")}
            className={`w-full text-left p-4 rounded-2xl border-2 transition ${
              selected === "beta_free"
                ? "border-cyan-500 bg-cyan-500/10"
                : "border-gray-700 bg-hate-gray hover:border-gray-500"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-white text-base">Beta gratuita</p>
                <p className="text-gray-400 text-sm mt-0.5">6 meses de acceso completo sin costo</p>
                <p className="text-gray-600 text-xs mt-1">Después del beta, precio regular</p>
              </div>
              <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded-full shrink-0 ml-2">GRATIS</span>
            </div>
            {selected === "beta_free" && <p className="text-cyan-400 text-xs mt-2 font-semibold">✓ Seleccionado</p>}
          </button>

          {/* Lifetime */}
          <button
            onClick={() => !lifetimeSoldOut && setSelected("lifetime_pending")}
            disabled={lifetimeSoldOut}
            className={`w-full text-left p-4 rounded-2xl border-2 transition relative ${
              lifetimeSoldOut
                ? "border-gray-800 bg-hate-gray opacity-50 cursor-not-allowed"
                : selected === "lifetime_pending"
                ? "border-fuchsia-500 bg-fuchsia-500/10"
                : "border-gray-700 bg-hate-gray hover:border-gray-500"
            }`}
          >
            {!lifetimeSoldOut && (
              <div className="absolute -top-2.5 left-4 bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white text-xs font-black px-3 py-0.5 rounded-full">
                ⚡ OFERTA LIMITADA
              </div>
            )}
            <div className="flex items-start justify-between mt-1">
              <div>
                <p className="font-bold text-white text-base">Membresía de por vida</p>
                <p className="text-gray-400 text-sm mt-0.5">Acceso completo para siempre, un solo pago</p>
                {spots && (
                  <p className={`text-xs mt-1 font-semibold ${lifetimeSoldOut ? "text-red-400" : "text-amber-400"}`}>
                    {lifetimeSoldOut
                      ? "Agotado — todos los lugares tomados"
                      : `${spots.remaining} de 200 lugares disponibles`}
                  </p>
                )}
              </div>
              <div className="shrink-0 ml-2 text-right">
                <p className="text-fuchsia-400 font-black text-lg">$9.99</p>
                <p className="text-gray-600 text-xs">USD · único</p>
              </div>
            </div>
            {selected === "lifetime_pending" && <p className="text-fuchsia-400 text-xs mt-2 font-semibold">✓ Seleccionado · pago al finalizar</p>}
          </button>

          {/* Tester voluntario */}
          <button
            onClick={() => setSelected("tester")}
            className={`w-full text-left p-4 rounded-2xl border-2 transition ${
              selected === "tester"
                ? "border-amber-500 bg-amber-500/10"
                : "border-gray-700 bg-hate-gray hover:border-gray-500"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-white text-base">Tester voluntario</p>
                <p className="text-gray-400 text-sm mt-0.5">Acceso gratis a cambio de tu feedback</p>
                <p className="text-gray-600 text-xs mt-1">Reportás bugs, sugerís mejoras, formás parte del equipo</p>
              </div>
              <span className="bg-amber-500/20 text-amber-400 text-xs font-bold px-2 py-1 rounded-full shrink-0 ml-2">BETA</span>
            </div>
            {selected === "tester" && <p className="text-amber-400 text-xs mt-2 font-semibold">✓ Seleccionado</p>}
          </button>
        </div>

        <button
          onClick={handleContinue}
          className="w-full py-4 rounded-2xl font-black text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:opacity-90 transition"
        >
          {selected === "lifetime_pending" ? "Reservar lugar → Crear cuenta" : "Crear cuenta →"}
        </button>

        {selected === "lifetime_pending" && (
          <p className="text-gray-600 text-xs text-center mt-3">
            El pago se completa después de crear tu cuenta. Tu lugar queda reservado.
          </p>
        )}
      </div>
    </div>
  );
}
