"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

function VerifyEmailContent() {
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    if (!token) { setStatus("error"); return; }
    apiFetch(`/auth/verify-email?token=${token}`, { method: "GET" })
      .then(() => setStatus("ok"))
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-hate-gray rounded-xl p-8 text-center space-y-4">
        {status === "loading" && <p className="text-gray-400 animate-pulse">Verificando...</p>}
        {status === "ok" && (
          <>
            <div className="text-5xl">✅</div>
            <p className="text-white font-bold text-lg">¡Email verificado!</p>
            <p className="text-gray-400 text-sm">Tu cuenta está activa.</p>
            <Link href="/login" className="block bg-hate-red text-white font-bold py-2 rounded-lg mt-4 hover:bg-red-700 transition">
              Ir al login
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-5xl">❌</div>
            <p className="text-white font-bold text-lg">Token inválido o expirado</p>
            <p className="text-gray-400 text-sm">El link de verificación ya fue usado o expiró.</p>
            <Link href="/login" className="block text-hate-red text-sm hover:underline mt-2">
              Volver al login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return <Suspense><VerifyEmailContent /></Suspense>;
}
