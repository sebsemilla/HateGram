"use client";
import { useState } from "react";
import { auth } from "@/lib/api";

export default function VerifyBanner() {
  const [sent, setSent] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (dismissed) return null;

  async function resend() {
    setLoading(true);
    try {
      await auth.resendVerification();
      setSent(true);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[430px] bg-amber-900/30 border border-amber-700/50 rounded-xl px-4 py-3 flex items-start gap-3 flex-shrink-0 mt-2">
      <span className="text-amber-400 text-lg shrink-0 mt-0.5">⚠️</span>
      <div className="flex-1 min-w-0">
        {sent ? (
          <p className="text-amber-300 text-sm">Email reenviado. Revisá tu bandeja de entrada.</p>
        ) : (
          <>
            <p className="text-amber-300 text-sm font-medium">Verificá tu email</p>
            <p className="text-amber-500 text-xs mt-0.5">Revisá tu bandeja de entrada o&nbsp;
              <button
                onClick={resend}
                disabled={loading}
                className="underline hover:text-amber-300 transition disabled:opacity-50"
              >
                {loading ? "enviando..." : "reenviar el email"}
              </button>
            </p>
          </>
        )}
      </div>
      <button onClick={() => setDismissed(true)} className="text-amber-700 hover:text-amber-400 transition text-lg leading-none shrink-0">×</button>
    </div>
  );
}
