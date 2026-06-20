"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { notifApi } from "@/lib/api";

interface Notif {
  id: number;
  type: string;
  body: string;
  is_read: boolean;
  link: string | null;
  actor_username: string | null;
  actor_avatar: string | null;
  created_at: string;
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function NotificationBell() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  // Poll unread count cada 30s
  useEffect(() => {
    function fetchCount() {
      notifApi.unreadCount().then((r) => setCount(r.count)).catch(() => {});
    }
    fetchCount();
    const id = setInterval(fetchCount, 30000);
    return () => clearInterval(id);
  }, []);

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleOpen() {
    if (!open) {
      const list = await notifApi.list().catch(() => []);
      setNotifs(list);
      if (count > 0) {
        notifApi.markAllRead().then(() => setCount(0)).catch(() => {});
      }
    }
    setOpen((v) => !v);
  }

  async function handleClick(n: Notif) {
    if (!n.is_read) notifApi.markRead(n.id).catch(() => {});
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative p-2 text-gray-400 hover:text-white transition"
        aria-label="Notificaciones"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-hate-red text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-hate-gray border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <span className="text-white font-semibold text-sm">Notificaciones</span>
            {notifs.some((n) => !n.is_read) && (
              <button
                onClick={() => { notifApi.markAllRead(); setNotifs((p) => p.map((n) => ({ ...n, is_read: true }))); setCount(0); }}
                className="text-xs text-gray-500 hover:text-gray-300 transition"
              >
                Marcar todo leído
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifs.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">Sin notificaciones</p>
            ) : (
              notifs.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-hate-light transition border-b border-gray-800 last:border-0 ${!n.is_read ? "bg-hate-light/50" : ""}`}
                >
                  {n.actor_avatar ? (
                    <img src={n.actor_avatar} className="w-9 h-9 rounded-full shrink-0 object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gray-700 shrink-0 flex items-center justify-center text-base">
                      🔔
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white leading-snug">{n.body}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && (
                    <div className="w-2 h-2 rounded-full bg-hate-red shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
