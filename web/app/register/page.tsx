"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";
import LanguageSelector from "@/components/LanguageSelector";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { lang, changeLang, t } = useLanguage();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const country = localStorage.getItem("onboarding_country") || "";
      const membership_type = localStorage.getItem("onboarding_membership") || "beta_free";
      const data = await auth.register({ ...form, country, membership_type });
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("has_visited", "1");
      localStorage.removeItem("onboarding_country");
      localStorage.removeItem("onboarding_membership");
      router.push("/onboarding/interests");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Progress (solo si viene del onboarding) */}
        {typeof window !== "undefined" && localStorage.getItem("onboarding_country") !== null && (
          <div className="flex gap-1.5 mb-6">
            <div className="h-1 flex-1 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-600" />
            <div className="h-1 flex-1 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-600" />
            <div className="h-1 flex-1 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-600" />
          </div>
        )}
        <h1 className="text-4xl font-black text-center mb-2 bg-gradient-to-r from-cyan-400 to-fuchsia-600 bg-clip-text text-transparent">feedpod</h1>
        <p className="text-center text-gray-400 mb-8 text-sm">{t("register_subtitle")}</p>

        {/* Selector de idioma */}
        <div className="mb-6">
          <p className="text-center text-gray-500 text-xs mb-3 uppercase tracking-wider">{t("choose_language")}</p>
          <LanguageSelector value={lang} onChange={changeLang} />
        </div>

        <form onSubmit={handleSubmit} className="bg-hate-gray rounded-xl p-6 space-y-4">
          {/* Username */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t("username")}</label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={30}
              autoComplete="username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full bg-hate-light border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-hate-red"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t("email")}</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-hate-light border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-hate-red"
            />
          </div>

          {/* Contraseña con ojito */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t("password")}</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-hate-light border border-gray-700 rounded-lg px-4 py-2 pr-10 text-white focus:outline-none focus:border-hate-red"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-200 transition"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
            <p className="text-gray-600 text-xs mt-1">Mínimo 6 caracteres, con al menos una letra y un número</p>
          </div>

          {error && <p className="text-hate-red text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-hate-red hover:bg-red-700 text-white font-bold py-2 rounded-lg transition disabled:opacity-50"
          >
            {loading ? t("creating") : t("create_account")}
          </button>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-gray-700" />
            <span className="text-gray-600 text-xs">o</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          <a
            href="http://localhost:8000/auth/google"
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-semibold py-2 rounded-lg transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuar con Google
          </a>
        </form>

        <p className="text-center text-gray-500 text-sm mt-4">
          {t("already_account")}{" "}
          <Link href="/login" className="text-hate-red hover:underline">
            {t("go_login")}
          </Link>
        </p>
      </div>
    </div>
  );
}
