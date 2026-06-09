"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { messagesApi } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";

export default function ThreadPage() {
  const { username } = useParams() as { username: string };
  const router = useRouter();
  const { t } = useLanguage();
  const [thread, setThread] = useState<any>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [me, setMe] = useState<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.replace("/login"); return; }
    const u = localStorage.getItem("user");
    if (u) setMe(JSON.parse(u));
    messagesApi.thread(username).then(setThread).catch(() => router.replace("/messages"));
  }, [username, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError("");
    try {
      const msg = await messagesApi.send(username, { content: text.trim() });
      setThread((th: any) => ({ ...th, bilateral: true, messages: [...th.messages, msg] }));
      setText("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  function timeStr(iso: string) {
    return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  }

  if (!thread) return (
    <div className="min-h-screen flex items-center justify-center text-gray-600">{t("messages_loading")}</div>
  );

  const peer = thread.user;
  const messages: any[] = thread.messages;
  const bilateral: boolean = thread.bilateral;
  const isSolo = !bilateral && messages.length >= 1 && messages[0]?.sender_id === me?.id;

  return (
    <div className="h-screen bg-hate-dark flex flex-col max-w-[430px] mx-auto">
      {/* Header */}
      <nav className="bg-hate-gray border-b border-gray-800 px-4 py-3 flex items-center gap-3 flex-shrink-0 sticky top-0 z-20">
        <Link href="/messages" className="text-gray-400 hover:text-white text-sm transition">←</Link>
        <Link href={`/profile/${peer.username}`} className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-hate-light overflow-hidden flex-shrink-0">
            {peer.avatar_url
              ? <img src={peer.avatar_url} className="w-full h-full object-cover" alt="" />
              : <span className="text-hate-red font-black text-xs flex items-center justify-center h-full">{peer.display_name[0]}</span>
            }
          </div>
          <p className="text-white font-bold text-sm truncate">{peer.display_name}</p>
        </Link>
      </nav>

      {/* Banner primer mensaje */}
      {isSolo && (
        <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-2.5 text-xs text-blue-400 flex-shrink-0">
          {t("msg_sent_pre")} <strong>@{peer.username}</strong> {t("msg_sent_post")}
        </div>
      )}

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-gray-600 text-sm py-8">
            {t("msg_start_convo")} <strong className="text-gray-400">@{peer.username}</strong>
          </div>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id !== peer.id;
          return (
            <div key={msg.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
              {msg.shared_post && (
                <div className={`max-w-[75%] mb-1 rounded-2xl overflow-hidden border border-gray-700 ${isMine ? "bg-hate-red/10" : "bg-hate-gray"}`}>
                  {(msg.shared_post.image_url || msg.shared_post.link_image) && (
                    <img src={msg.shared_post.image_url || msg.shared_post.link_image} className="w-full object-cover max-h-32" alt="" />
                  )}
                  <div className="px-3 py-2">
                    <p className="text-gray-500 text-xs">📎 Post @{msg.shared_post.username}</p>
                    {msg.shared_post.link_title && <p className="text-white text-xs font-semibold mt-0.5 line-clamp-2">{msg.shared_post.link_title}</p>}
                    {!msg.shared_post.link_title && msg.shared_post.caption && (
                      <p className="text-gray-300 text-xs mt-0.5 line-clamp-2">{msg.shared_post.caption}</p>
                    )}
                  </div>
                </div>
              )}
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                isMine ? "bg-hate-red text-white rounded-br-sm" : "bg-hate-gray text-gray-200 rounded-bl-sm"
              }`}>
                {msg.content}
              </div>
              <span className="text-gray-700 text-xs mt-0.5 px-1">{timeStr(msg.created_at)}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 bg-hate-gray flex-shrink-0">
        {error && <p className="text-hate-red text-xs px-4 pt-2">{error}</p>}
        <form onSubmit={handleSend} className="flex items-center gap-2 px-3 py-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={isSolo ? t("msg_wait") : t("msg_write")}
            disabled={isSolo}
            className="flex-1 bg-hate-light border border-gray-700 rounded-full px-4 py-2.5 text-white text-sm focus:outline-none focus:border-hate-red disabled:opacity-40 disabled:cursor-not-allowed placeholder-gray-600"
          />
          <button
            type="submit"
            disabled={sending || !text.trim() || isSolo}
            className="w-10 h-10 bg-hate-red hover:bg-red-700 rounded-full flex items-center justify-center transition disabled:opacity-40"
          >
            <svg className="w-4 h-4 text-white rotate-90" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
