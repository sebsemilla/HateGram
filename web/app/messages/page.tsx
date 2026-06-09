"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { messagesApi } from "@/lib/api";

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.replace("/login"); return; }
    messagesApi.conversations().then(setConversations).finally(() => setLoading(false));
  }, [router]);

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "ahora";
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }

  return (
    <div className="min-h-screen bg-hate-dark flex flex-col max-w-[430px] mx-auto">
      <nav className="bg-hate-gray border-b border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <Link href="/feed" className="text-gray-400 hover:text-white text-sm transition">←</Link>
        <span className="text-white font-black text-lg flex-1">Mensajes</span>
      </nav>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-600">Cargando...</div>
      ) : conversations.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-3 px-8 text-center">
          <p className="text-5xl">✉️</p>
          <p className="text-sm">No tenés conversaciones aún.<br/>Visitá un perfil y presioná Contactar.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-800/60">
          {conversations.map((c) => (
            <Link
              key={c.user.username}
              href={`/messages/${c.user.username}`}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-hate-gray transition"
            >
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-hate-light overflow-hidden flex items-center justify-center">
                  {c.user.avatar_url
                    ? <img src={c.user.avatar_url} className="w-full h-full object-cover" alt="" />
                    : <span className="text-hate-red font-black">{c.user.display_name[0]}</span>
                  }
                </div>
                {c.unread_count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-hate-red rounded-full text-white text-xs flex items-center justify-center font-bold">
                    {c.unread_count > 9 ? "9+" : c.unread_count}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-bold truncate ${c.unread_count > 0 ? "text-white" : "text-gray-300"}`}>
                    {c.user.display_name}
                  </p>
                  {c.last_message && (
                    <span className="text-gray-600 text-xs flex-shrink-0 ml-2">{timeAgo(c.last_message.created_at)}</span>
                  )}
                </div>
                {c.last_message && (
                  <p className={`text-xs truncate mt-0.5 ${c.unread_count > 0 ? "text-gray-300 font-semibold" : "text-gray-600"}`}>
                    {c.last_message.shared_post ? "📎 Post compartido" : c.last_message.content}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
