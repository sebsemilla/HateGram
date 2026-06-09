"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { factsApi, debatesApi, pinsApi, messagesApi, repostApi, profiles } from "@/lib/api";

interface Post {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string;
  caption: string;
  image_url: string;
  link_url: string;
  link_title: string;
  link_description: string;
  link_image: string;
  community_name?: string;
  created_at: string;
  user_id: number;
  is_pinned?: boolean;
  pin_count?: number;
  repost_of_id?: number;
  repost_of_username?: string;
  repost_of_display_name?: string;
  repost_count?: number;
}

const POST_ACTIONS = [
  { key: "like",     label: "Like",     icon: "/icons/like icon.png" },
  { key: "comment",  label: "Comment",  icon: "/icons/Letra S.png" },
  { key: "share",    label: "Share",    icon: "/icons/icono compartir.png" },
  { key: "favorite", label: "Favorite", icon: "/icons/fav icon.png" },
];

export default function PostCard({ post, currentUserId }: { post: Post; currentUserId?: number }) {
  const [liked, setLiked] = useState(false);

  // Truth/Fake
  const [facts, setFacts] = useState<any>(null);
  const [factsLoading, setFactsLoading] = useState(false);
  const [showFacts, setShowFacts] = useState(false);

  // Debate
  const [debate, setDebate] = useState<any>(undefined);
  const [debateLoading, setDebateLoading] = useState(false);
  const [showDebateMenu, setShowDebateMenu] = useState(false);

  // Save / Pin
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [pinned, setPinned] = useState(post.is_pinned ?? false);
  const [pinCount, setPinCount] = useState(post.pin_count ?? 0);

  // Share
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareStep, setShareStep] = useState<"menu" | "contacts">("menu");
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [shareMsg, setShareMsg] = useState("");
  const [sharing, setSharing] = useState(false);
  const [repostCount, setRepostCount] = useState(post.repost_count ?? 0);

  useEffect(() => {
    factsApi.get(post.id).then(setFacts).catch(() => {});
    debatesApi.get(post.id).then(setDebate).catch(() => setDebate(null));
  }, [post.id]);

  // Cargar contactos cuando se abre el selector
  useEffect(() => {
    if (shareStep === "contacts" && contacts.length === 0) {
      profiles.list().then(setContacts).catch(() => {});
    }
  }, [shareStep]);

  async function handleFactVote(vote: "truth" | "fake") {
    setFactsLoading(true);
    try {
      const res = await factsApi.vote(post.id, vote);
      setFacts(res);
    } finally {
      setFactsLoading(false);
    }
  }

  async function handleDebateVote(side: "for" | "against") {
    setDebateLoading(true);
    try {
      const res = await debatesApi.vote(post.id, side);
      setDebate(res);
    } finally {
      setDebateLoading(false);
    }
  }

  async function handleCreateDebate(hours: number) {
    setDebateLoading(true);
    setShowDebateMenu(false);
    try {
      const res = await debatesApi.create(post.id, hours);
      setDebate(res);
    } finally {
      setDebateLoading(false);
    }
  }

  async function handleSendToContacts() {
    if (!selectedUsers.length) return;
    setSharing(true);
    try {
      for (const username of selectedUsers) {
        await messagesApi.send(username, {
          content: shareMsg.trim() || "Te comparto este post 👇",
          shared_post_id: post.id,
        });
      }
      setShowShareSheet(false);
      setShareStep("menu");
      setSelectedUsers([]);
      setShareMsg("");
    } catch {
      // ignore individual errors
    } finally {
      setSharing(false);
    }
  }

  async function handleRepost() {
    try {
      await repostApi.repost(post.id);
      setRepostCount((n) => n + 1);
      setShowShareSheet(false);
    } catch {}
  }

  function closeShareSheet() {
    setShowShareSheet(false);
    setShareStep("menu");
    setSelectedUsers([]);
    setShareMsg("");
  }

  const isMyPost = currentUserId === post.user_id;
  const debateIsActive = debate && debate.status === "active";
  const debateIsClosed = debate && debate.status === "closed";
  const postAgeHours = (Date.now() - new Date(post.created_at).getTime()) / 3600000;
  const canActivateDebate = isMyPost && !debate && postAgeHours < 24;

  function timeLeft(closesAt: string) {
    const diff = new Date(closesAt).getTime() - Date.now();
    if (diff <= 0) return "Cerrado";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  return (
    <div className="border-b border-gray-800 bg-hate-dark">

      {/* Label de Repost */}
      {post.repost_of_id && post.repost_of_username && (
        <div className="flex items-center gap-1.5 px-4 pt-2.5 pb-0">
          <span className="text-gray-500 text-xs">🔁 Reposted de</span>
          <Link href={`/profile/${post.repost_of_username}`} className="text-gray-400 text-xs font-semibold hover:text-white transition">
            @{post.repost_of_username}
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Link href={`/profile/${post.username}`}>
          <div className="w-9 h-9 rounded-full bg-hate-light overflow-hidden flex-shrink-0 flex items-center justify-center border border-gray-700">
            {post.avatar_url
              ? <img src={post.avatar_url} alt={post.display_name} className="w-full h-full object-cover" />
              : <span className="text-hate-red font-black text-sm">{post.display_name[0]}</span>
            }
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/profile/${post.username}`} className="text-white font-bold text-sm hover:underline leading-none">
            {post.display_name}
          </Link>
          <p className="text-gray-600 text-xs">@{post.username}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {post.community_name && (
            <span className="text-xs text-gray-500 bg-hate-gray px-2 py-0.5 rounded-full border border-gray-700">
              {post.community_name}
            </span>
          )}
          <button
            onClick={() => setShowFacts((v) => !v)}
            className={`text-xs font-bold px-2.5 py-1 rounded-lg transition ${
              showFacts
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                : "text-gray-500 hover:text-blue-400 hover:bg-blue-500/10"
            }`}
          >
            🔍 Verify
          </button>
          {canActivateDebate && (
            <div className="relative">
              <button
                onClick={() => setShowDebateMenu((v) => !v)}
                className="text-xs text-gray-500 hover:text-hate-red transition px-2 py-1 rounded-lg hover:bg-hate-gray"
              >
                ⚡ Debate
              </button>
              {showDebateMenu && (
                <div className="absolute right-0 top-7 bg-hate-gray border border-gray-700 rounded-xl p-3 z-20 w-44 shadow-xl">
                  <p className="text-gray-400 text-xs mb-2 font-semibold">Duración del debate</p>
                  {[24, 48, 72].map((h) => (
                    <button key={h} onClick={() => handleCreateDebate(h)}
                      className="w-full text-left text-sm text-gray-300 hover:text-hate-red py-1.5 px-2 rounded-lg hover:bg-hate-light transition">
                      {h} horas
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {debateIsActive && (
            <span className="flex items-center gap-1 text-xs text-green-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Debate
            </span>
          )}
        </div>
      </div>

      {/* Truth/Fake */}
      {showFacts && (
        <div className="mx-4 mb-2 rounded-2xl overflow-hidden border border-blue-500/20 bg-hate-gray/50">
          {post.link_url ? (
            <div className="px-4 py-2.5 border-b border-gray-800/50">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">Fuente</p>
              <a href={post.link_url} target="_blank" rel="noopener noreferrer"
                className="text-blue-400 text-xs hover:underline break-all">{post.link_url}</a>
            </div>
          ) : (
            <div className="px-4 py-2.5 border-b border-gray-800/50">
              <p className="text-gray-500 text-xs">Sin fuente adjunta</p>
            </div>
          )}
          <div className="flex">
            <button onClick={() => handleFactVote("truth")} disabled={factsLoading}
              className={`flex-1 py-2.5 text-xs font-black tracking-widest uppercase transition ${facts?.my_vote === "truth" ? "bg-green-500 text-white" : "bg-transparent text-gray-400 hover:bg-green-500/20 hover:text-green-400"}`}>
              ✅ Truth {facts?.total > 0 && `${facts.truth_pct}%`}
            </button>
            <div className="w-px bg-gray-800" />
            <button onClick={() => handleFactVote("fake")} disabled={factsLoading}
              className={`flex-1 py-2.5 text-xs font-black tracking-widest uppercase transition ${facts?.my_vote === "fake" ? "bg-hate-red text-white" : "bg-transparent text-gray-400 hover:bg-hate-red/20 hover:text-hate-red"}`}>
              ❌ Fake {facts?.total > 0 && `${facts.fake_pct}%`}
            </button>
          </div>
          {facts?.total > 0 && (
            <div className="flex h-1">
              <div className="bg-green-500 transition-all" style={{ width: `${facts.truth_pct}%` }} />
              <div className="bg-hate-red transition-all" style={{ width: `${facts.fake_pct}%` }} />
            </div>
          )}
        </div>
      )}

      {/* Imagen */}
      {post.image_url && (
        <img src={post.image_url} alt={post.caption} className="w-full object-cover" style={{ maxHeight: 400 }} />
      )}

      {/* Link preview */}
      {post.link_url && (
        <a href={post.link_url} target="_blank" rel="noopener noreferrer"
          className="block mx-4 mb-1 rounded-xl overflow-hidden border border-gray-700 hover:border-hate-red transition">
          {post.link_image && <img src={post.link_image} alt="" className="w-full object-cover" style={{ maxHeight: 180 }} />}
          <div className="p-3 bg-hate-gray">
            <p className="text-gray-500 text-xs uppercase tracking-wide">{new URL(post.link_url).hostname}</p>
            {post.link_title && <p className="text-white text-sm font-bold mt-0.5 leading-snug">{post.link_title}</p>}
            {post.link_description && <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">{post.link_description}</p>}
          </div>
        </a>
      )}

      {/* Acciones */}
      <div className="flex justify-around px-1 py-1">
        {POST_ACTIONS.map(({ key, label, icon }) => {
          const isLike = key === "like";
          const isShare = key === "share";
          const isFavorite = key === "favorite";
          return (
            <button
              key={key}
              onClick={() => {
                if (isLike) setLiked((v) => !v);
                if (isShare) { setShowShareSheet(true); setShareStep("menu"); }
                if (isFavorite) setShowSaveSheet(true);
              }}
              className="flex items-center justify-center p-1 transition hover:opacity-70"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition ${isLike && liked ? "bg-[#AAFF00]" : "bg-transparent"}`}>
                <img src={icon} alt={label} className="w-8 h-8 object-contain" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Caption */}
      <div className="px-4 pt-0 pb-3">
        {post.caption && (
          <p className="text-gray-200 text-sm leading-relaxed">
            <span className="font-bold text-white mr-1">{post.display_name}</span>
            {post.caption}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <p className="text-gray-700 text-xs">
            {new Date(post.created_at).toLocaleDateString("es", { day: "2-digit", month: "short" })}
          </p>
          {pinCount > 0 && <span className="text-gray-600 text-xs">📌 {pinCount}</span>}
          {repostCount > 0 && <span className="text-gray-600 text-xs">🔁 {repostCount}</span>}
        </div>
      </div>

      {/* Debate */}
      {debate && (
        <div className="mx-4 mb-4 rounded-2xl border border-gray-700 overflow-hidden">
          <div className={`px-4 py-2.5 flex items-center justify-between ${debateIsClosed ? "bg-gray-800/50" : "bg-hate-gray"}`}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${debateIsActive ? "bg-green-400 animate-pulse" : "bg-gray-600"}`} />
              <span className="text-white font-black text-xs tracking-widest uppercase">
                {debateIsClosed ? "Debate cerrado" : "Debate activo"}
              </span>
            </div>
            {debateIsActive && <span className="text-gray-400 text-xs">{timeLeft(debate.closes_at)}</span>}
          </div>
          {debateIsClosed && debate.winner && (
            <div className={`px-4 py-2 text-center text-sm font-black ${
              debate.winner === "for" ? "text-green-400" :
              debate.winner === "against" ? "text-hate-red" : "text-gray-400"
            }`}>
              {debate.winner === "for" ? "✅ Ganó: A Favor" :
               debate.winner === "against" ? "❌ Ganó: En Contra" : "🤝 Empate"}
            </div>
          )}
          <div className="flex">
            <button onClick={() => debateIsActive && handleDebateVote("for")}
              disabled={debateLoading || debateIsClosed}
              className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition ${debate.my_vote === "for" ? "bg-green-500/20 text-green-400" : debateIsActive ? "hover:bg-green-500/10 text-gray-400 hover:text-green-400" : "text-gray-600"}`}>
              <span className="font-black text-sm">A Favor</span>
              <span className="text-xs">{debate.for_count} {debate.total > 0 && `· ${debate.for_pct}%`}</span>
            </button>
            <div className="w-px bg-gray-700" />
            <button onClick={() => debateIsActive && handleDebateVote("against")}
              disabled={debateLoading || debateIsClosed}
              className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition ${debate.my_vote === "against" ? "bg-hate-red/20 text-hate-red" : debateIsActive ? "hover:bg-hate-red/10 text-gray-400 hover:text-hate-red" : "text-gray-600"}`}>
              <span className="font-black text-sm">En Contra</span>
              <span className="text-xs">{debate.against_count} {debate.total > 0 && `· ${debate.against_pct}%`}</span>
            </button>
          </div>
          {debate.total > 0 && (
            <div className="flex h-1">
              <div className="bg-green-500 transition-all" style={{ width: `${debate.for_pct}%` }} />
              <div className="bg-hate-red transition-all" style={{ width: `${debate.against_pct}%` }} />
            </div>
          )}
        </div>
      )}

      {/* ── Share Bottom Sheet ── */}
      {showShareSheet && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeShareSheet} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-hate-gray border-t border-gray-700 rounded-t-2xl max-w-[430px] mx-auto" style={{ maxHeight: "80vh" }}>
            <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mt-3 mb-2" />

            {shareStep === "menu" ? (
              <div className="p-4 space-y-2">
                <p className="text-gray-500 text-xs uppercase tracking-wider font-semibold px-1 mb-3">Compartir</p>

                {/* A Historias */}
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-hate-light transition text-left">
                  <span className="text-2xl">📸</span>
                  <div>
                    <p className="text-white font-semibold text-sm">A Historias</p>
                    <p className="text-gray-500 text-xs">Próximamente</p>
                  </div>
                </button>

                {/* Como mensaje */}
                <button
                  onClick={() => setShareStep("contacts")}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-hate-light transition text-left"
                >
                  <span className="text-2xl">✉️</span>
                  <div>
                    <p className="text-white font-semibold text-sm">Como mensaje</p>
                    <p className="text-gray-500 text-xs">Envialo a uno o más contactos</p>
                  </div>
                </button>

                {/* Repost */}
                <button
                  onClick={handleRepost}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-hate-light transition text-left"
                >
                  <span className="text-2xl">🔁</span>
                  <div>
                    <p className="text-white font-semibold text-sm">Repost</p>
                    <p className="text-gray-500 text-xs">Publicar en tu perfil como repost</p>
                  </div>
                </button>
              </div>
            ) : (
              /* Selector de contactos */
              <div className="flex flex-col" style={{ maxHeight: "75vh" }}>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 flex-shrink-0">
                  <button onClick={() => setShareStep("menu")} className="text-gray-400 hover:text-white text-sm">←</button>
                  <p className="text-white font-bold text-sm flex-1">Enviar a...</p>
                  <button
                    onClick={handleSendToContacts}
                    disabled={!selectedUsers.length || sharing}
                    className="text-xs bg-hate-red hover:bg-red-700 text-white font-bold px-4 py-1.5 rounded-xl transition disabled:opacity-40"
                  >
                    {sharing ? "..." : `Enviar${selectedUsers.length > 0 ? ` (${selectedUsers.length})` : ""}`}
                  </button>
                </div>

                {/* Mensaje opcional */}
                <div className="px-4 py-2 border-b border-gray-800 flex-shrink-0">
                  <input
                    value={shareMsg}
                    onChange={(e) => setShareMsg(e.target.value)}
                    placeholder="Añadir mensaje... (opcional)"
                    className="w-full bg-hate-light border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-hate-red placeholder-gray-600"
                  />
                </div>

                {/* Lista de contactos */}
                <div className="overflow-y-auto flex-1 divide-y divide-gray-800/50">
                  {contacts
                    .filter((c) => c.username !== post.username)
                    .map((c) => {
                      const selected = selectedUsers.includes(c.username);
                      return (
                        <button
                          key={c.username}
                          onClick={() => setSelectedUsers((prev) =>
                            selected ? prev.filter((u) => u !== c.username) : [...prev, c.username]
                          )}
                          className={`w-full flex items-center gap-3 px-4 py-3 transition text-left ${selected ? "bg-hate-red/10" : "hover:bg-hate-gray"}`}
                        >
                          <div className="w-9 h-9 rounded-full bg-hate-light overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {c.avatar_url
                              ? <img src={c.avatar_url} className="w-full h-full object-cover" alt="" />
                              : <span className="text-hate-red font-black text-sm">{c.display_name[0]}</span>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-semibold truncate">{c.display_name}</p>
                            <p className="text-gray-500 text-xs">@{c.username}</p>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${selected ? "bg-hate-red border-hate-red" : "border-gray-600"}`}>
                            {selected && <span className="text-white text-xs">✓</span>}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Save Bottom Sheet ── */}
      {showSaveSheet && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowSaveSheet(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-hate-gray border-t border-gray-700 rounded-t-2xl p-4 space-y-2 max-w-[430px] mx-auto">
            <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-3" />
            <button
              onClick={() => setShowSaveSheet(false)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-hate-light transition text-left"
            >
              <span className="text-xl">⭐</span>
              <div>
                <p className="text-white font-semibold text-sm">Guardar en Favoritos</p>
                <p className="text-gray-500 text-xs">Próximamente</p>
              </div>
            </button>
            <button
              onClick={async () => {
                const res = await pinsApi.toggle(post.id);
                setPinned(res.pinned);
                setPinCount(res.pin_count);
                setShowSaveSheet(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-hate-light transition text-left ${pinned ? "bg-blue-500/10" : ""}`}
            >
              <span className="text-xl">📌</span>
              <div>
                <p className={`font-semibold text-sm ${pinned ? "text-blue-400" : "text-white"}`}>
                  {pinned ? "Quitar Pin up" : "Pin up"}
                </p>
                <p className="text-gray-500 text-xs">Guardar en tu colección Pinned</p>
              </div>
            </button>
          </div>
        </>
      )}

    </div>
  );
}
