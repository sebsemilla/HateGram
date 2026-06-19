"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await auth.login(form);
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      router.push("/feed");
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
        <p className="text-center text-gray-400 mb-8 text-sm">{t("login_subtitle")}</p>

        <form onSubmit={handleSubmit} className="bg-hate-gray rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t("username_or_email")}</label>
            <input
              type="text"
              required
              autoComplete="username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full bg-hate-light border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-hate-red"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t("password")}</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-hate-light border border-gray-700 rounded-lg px-4 py-2 pr-10 text-white focus:outline-none focus:border-hate-red"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-200"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? (
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
                )}
              </button>
            </div>
          </div>

          {error && <p className="text-hate-red text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-hate-red hover:bg-red-700 text-white font-bold py-2 rounded-lg transition disabled:opacity-50"
          >
            {loading ? t("logging_in") : t("log_in")}
          </button>
        </form>

        <div className="flex flex-col items-center gap-2 mt-4">
          <p className="text-gray-500 text-sm">
            {t("no_account")}{" "}
            <Link href="/register" className="text-hate-red hover:underline">
              {t("go_register")}
            </Link>
          </p>
          <Link href="/forgot-password" className="text-gray-600 hover:text-gray-400 text-xs transition">
            {t("forgot_password")}
          </Link>
        </div>
      </div>
    </div>
  );
}
