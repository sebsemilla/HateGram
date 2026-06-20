"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { searchApi, apiFetch } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Tab = "all" | "users" | "posts";

interface UserResult {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  is_following: boolean;
}

interface PostResult {
  id: number;
  caption: string;
  image_url: string;
  created_at: string;
  username: string;
  display_name: string;
  avatar_url: string;
}

export default function SearchPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [users, setUsers] = useState<UserResult[]>([]);
  const [posts, setPosts] = useState<PostResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (query: string, type: Tab) => {
    if (!query.trim()) { setUsers([]); setPosts([]); return; }
    setLoading(true);
    try {
      const res = await searchApi.search(query, type);
      setUsers(res.users ?? []);
      setPosts(res.posts ?? []);
    } catch {
      setUsers([]); setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(q, tab), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q, tab, doSearch]);

  async function toggleFollow(user: UserResult) {
    await apiFetch(`/follow/${user.username}`, { method: "POST" });
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_following: !u.is_following } : u));
  }

  const showUsers = tab === "all" || tab === "users";
  const showPosts = tab === "all" || tab === "posts";

  return (
    <div className="min-h-screen bg-hate-dark flex flex-col items-center pb-20">
      {/* Navbar */}
      <nav className="w-full max-w-[430px] bg-hate-gray border-b border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-sm transition">← Volver</button>
        <span className="text-xl font-black bg-gradient-to-r from-cyan-400 to-fuchsia-600 bg-clip-text text-transparent">feedpod</span>
      </nav>

      <div className="w-full max-w-[430px] px-4 pt-4">
        {/* Search input */}
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            autoFocus
            type="text"
            placeholder="Buscar usuarios o posts..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full bg-hate-gray border border-gray-700 rounded-xl pl-9 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition text-sm"
          />
          {q && (
            <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition text-lg leading-none">×</button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-hate-gray rounded-xl p-1">
          {(["all", "users", "posts"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab === t ? "bg-hate-light text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              {t === "all" ? "Todo" : t === "users" ? "Usuarios" : "Posts"}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {!q && (
          <p className="text-center text-gray-600 text-sm mt-12">Escribí algo para buscar</p>
        )}

        {loading && (
          <p className="text-center text-gray-600 text-sm mt-8 animate-pulse">Buscando...</p>
        )}

        {!loading && q && users.length === 0 && posts.length === 0 && (
          <p className="text-center text-gray-600 text-sm mt-12">Sin resultados para <span className="text-white">"{q}"</span></p>
        )}

        {/* Users */}
        {showUsers && users.length > 0 && (
          <section className="mb-6">
            {tab === "all" && <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-3">Usuarios</h2>}
            <div className="flex flex-col gap-2">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 bg-hate-gray rounded-xl px-4 py-3">
                  <Link href={`/profile/${u.username}`}>
                    {u.avatar_url ? (
                      <img src={u.avatar_url} className="w-11 h-11 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-gray-700 shrink-0 flex items-center justify-center text-lg font-bold text-gray-400">
                        {u.display_name[0]?.toUpperCase()}
                      </div>
                    )}
                  </Link>
                  <Link href={`/profile/${u.username}`} className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{u.display_name}</p>
                    <p className="text-gray-500 text-xs">@{u.username}</p>
                    {u.bio && <p className="text-gray-400 text-xs mt-0.5 truncate">{u.bio}</p>}
                  </Link>
                  <button
                    onClick={() => toggleFollow(u)}
                    className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition ${
                      u.is_following
                        ? "bg-hate-light text-gray-300 hover:bg-red-900/30 hover:text-red-400"
                        : "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                    }`}
                  >
                    {u.is_following ? "Siguiendo" : "Seguir"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Posts */}
        {showPosts && posts.length > 0 && (
          <section>
            {tab === "all" && <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-3">Posts</h2>}
            <div className="flex flex-col gap-2">
              {posts.map((p) => (
                <Link key={p.id} href={`/profile/${p.username}`} className="block bg-hate-gray rounded-xl px-4 py-3 hover:bg-hate-light transition">
                  <div className="flex items-center gap-2 mb-2">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-400">
                        {p.display_name[0]?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <span className="text-white text-sm font-semibold">{p.display_name}</span>
                      <span className="text-gray-500 text-xs ml-1">@{p.username}</span>
                    </div>
                  </div>
                  {p.image_url && (
                    <img src={p.image_url.startsWith("http") ? p.image_url : `${API_URL}${p.image_url}`} className="w-full rounded-lg mb-2 max-h-48 object-cover" />
                  )}
                  {p.caption && <p className="text-gray-300 text-sm leading-snug line-clamp-3">{p.caption}</p>}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
