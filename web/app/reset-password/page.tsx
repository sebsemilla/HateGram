"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/api";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [form, setForm] = useState({ password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!token) setError("Token inválido. Solicitá un nuevo link.");
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await auth.resetPassword(token, form.password);
      router.push("/login?reset=ok");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-4xl font-black text-center mb-2 bg-gradient-to-r from-cyan-400 to-fuchsia-600 bg-clip-text text-transparent">feedpod</h1>
        <p className="text-center text-gray-400 mb-8 text-sm">Nueva contraseña</p>

        <form onSubmit={handleSubmit} className="bg-hate-gray rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nueva contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-hate-light border border-gray-700 rounded-lg px-4 py-2 pr-10 text-white focus:outline-none focus:border-hate-red"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-200"
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>
            <p className="text-gray-600 text-xs mt-1">Mínimo 6 caracteres, con al menos una letra y un número</p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Confirmar contraseña</label>
            <input
              type={showPassword ? "text" : "password"}
              required
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              className="w-full bg-hate-light border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-hate-red"
            />
          </div>

          {error && <p className="text-hate-red text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !token}
            className="w-full bg-hate-red hover:bg-red-700 text-white font-bold py-2 rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Cambiar contraseña"}
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-4">
          <Link href="/login" className="text-hate-red hover:underline">
            ← Volver al login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
