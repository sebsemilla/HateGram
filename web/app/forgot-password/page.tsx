"use client";
import { useState } from "react";
import Link from "next/link";
import { auth } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [devToken, setDevToken] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await auth.forgotPassword(email);
      setSent(true);
      if (res.dev_token) setDevToken(res.dev_token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-4xl font-black text-hate-red text-center mb-2">HateGram</h1>
        <p className="text-center text-gray-400 mb-8 text-sm">Recuperá tu contraseña</p>

        {sent ? (
          <div className="bg-hate-gray rounded-xl p-6 text-center space-y-4">
            <div className="text-4xl">📬</div>
            <p className="text-white font-semibold">Revisá tu email</p>
            <p className="text-gray-400 text-sm">
              Si el email está registrado, recibirás un link para resetear tu contraseña.
            </p>
            {devToken && (
              <div className="bg-hate-light rounded-lg p-3 text-left">
                <p className="text-yellow-400 text-xs font-bold mb-1">⚠️ MODO DEV — Token de reset:</p>
                <Link
                  href={`/reset-password?token=${devToken}`}
                  className="text-hate-red text-xs break-all hover:underline"
                >
                  /reset-password?token={devToken}
                </Link>
              </div>
            )}
            <Link href="/login" className="block text-hate-red text-sm hover:underline">
              Volver al login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-hate-gray rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email de tu cuenta</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-hate-light border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-hate-red"
                placeholder="tu@email.com"
              />
            </div>

            {error && <p className="text-hate-red text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-hate-red hover:bg-red-700 text-white font-bold py-2 rounded-lg transition disabled:opacity-50"
            >
              {loading ? "Enviando..." : "Enviar instrucciones"}
            </button>
          </form>
        )}

        <p className="text-center text-gray-500 text-sm mt-4">
          <Link href="/login" className="text-hate-red hover:underline">
            ← Volver al login
          </Link>
        </p>
      </div>
    </div>
  );
}
