"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";
import LanguageSelector from "@/components/LanguageSelector";

export default function RegisterPage() {
  const router = useRouter();
  const { lang, changeLang, t } = useLanguage();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await auth.register(form);
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
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <h1 className="text-4xl font-black text-hate-red text-center mb-2">HateGram</h1>
        <p className="text-center text-gray-400 mb-8 text-sm">{t("register_subtitle")}</p>

        {/* Selector de idioma */}
        <div className="mb-6">
          <p className="text-center text-gray-500 text-xs mb-3 uppercase tracking-wider">{t("choose_language")}</p>
          <LanguageSelector value={lang} onChange={changeLang} />
        </div>

        <form onSubmit={handleSubmit} className="bg-hate-gray rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t("username")}</label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={30}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full bg-hate-light border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-hate-red"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t("email")}</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-hate-light border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-hate-red"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t("password")}</label>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full bg-hate-light border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-hate-red"
            />
          </div>

          {error && <p className="text-hate-red text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-hate-red hover:bg-red-700 text-white font-bold py-2 rounded-lg transition disabled:opacity-50"
          >
            {loading ? t("creating") : t("create_account")}
          </button>
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
