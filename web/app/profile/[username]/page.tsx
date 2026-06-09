"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { profiles, uploadImage, postApi, followApi, pinsApi, botApi } from "@/lib/api";
import FAB from "@/components/FAB";
import LanguageSelector from "@/components/LanguageSelector";
import { useLanguage } from "@/hooks/useLanguage";

interface Badge {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  score: number;
}

interface Profile {
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  banner_url: string;
  website: string;
  location: string;
  follower_count: number;
  following_count: number;
  badges: Badge[];
  is_fictitious?: boolean;
  bot_id?: number | null;
}

type ProfileTab = "photos" | "videos" | "pinned";

const HIGHLIGHTS = [
  { label: "Viajes", emoji: "✈️" },
  { label: "Fotos", emoji: "📸" },
  { label: "Daily", emoji: "☀️" },
  { label: "Arte", emoji: "🎨" },
];

const BOT_ACTION_OPTIONS = [
  { value: "post",         label: "✍️ Publicar post (frases)" },
  { value: "youtube_post", label: "📺 Postear desde YouTube" },
  { value: "vote_truth",   label: "✅ Votar Truth" },
  { value: "vote_fake",    label: "❌ Votar Fake" },
  { value: "vote_for",     label: "👍 Votar A Favor (debate)" },
  { value: "vote_against", label: "👎 Votar En Contra (debate)" },
];

function ImageUploadField({
  label, currentUrl, onUploaded,
}: { label: string; currentUrl: string; onUploaded: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onUploaded(url);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className={`flex-shrink-0 overflow-hidden bg-hate-light flex items-center justify-center ${label === "Avatar" ? "w-16 h-16 rounded-full" : "w-24 h-12 rounded-lg"}`}>
        {currentUrl
          ? <img src={currentUrl} alt={label} className="w-full h-full object-cover" />
          : <span className="text-gray-600 text-xs">{label === "Avatar" ? "👤" : "🖼️"}</span>
        }
      </div>
      <div className="flex-1">
        <p className="text-sm text-gray-400 mb-1.5">{label}</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-sm bg-hate-light hover:bg-gray-700 text-gray-300 px-4 py-1.5 rounded-lg transition disabled:opacity-50"
        >
          {uploading ? "..." : label}
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { lang, changeLang, t } = useLanguage();
  const username = params.username as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isMe, setIsMe] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    display_name: "", bio: "", location: "", website: "", avatar_url: "", banner_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [posts, setPosts] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  // Tabs
  const [activeTab, setActiveTab] = useState<ProfileTab>("photos");
  const [pinnedPosts, setPinnedPosts] = useState<any[]>([]);

  // Bot actions panel
  const [showActions, setShowActions] = useState(false);
  const [botData, setBotData] = useState<any>(null);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [actionsError, setActionsError] = useState("");
  const [newAction, setNewAction] = useState({ action_type: "post", frequency_hours: 6, content_pool_raw: "" });
  const [addingAction, setAddingAction] = useState(false);
  const [runningBot, setRunningBot] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.replace("/login"); return; }
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    setIsMe(u.username === username);
    setIsAdmin(u.is_admin === true);

    profiles.get(username).then((p) => {
      setProfile(p);
      setFollowerCount(p.follower_count ?? 0);
      setForm({
        display_name: p.display_name, bio: p.bio,
        location: p.location, website: p.website,
        avatar_url: p.avatar_url, banner_url: p.banner_url,
      });
    }).catch(() => router.replace("/feed"));

    postApi.byUser(username).then(setPosts).catch(() => {});

    if (u.username !== username) {
      followApi.status(username).then((s) => {
        setIsFollowing(s.following);
        setFollowerCount(s.follower_count);
      }).catch(() => {});
    }
  }, [username, router]);

  useEffect(() => {
    if (activeTab === "pinned") {
      pinsApi.byUser(username).then(setPinnedPosts).catch(() => {});
    }
  }, [activeTab, username]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      let updated: Profile;
      if (!isMe && isAdmin && profile?.is_fictitious && profile?.bot_id) {
        // Admin editing a bot profile directly (not impersonated)
        const botUpdated = await botApi.updateProfile(profile.bot_id, form);
        updated = {
          ...profile,
          display_name: botUpdated.display_name,
          bio: botUpdated.bio ?? "",
          location: botUpdated.location ?? "",
          website: botUpdated.website ?? "",
          avatar_url: botUpdated.avatar_url ?? "",
        };
      } else {
        updated = await profiles.update(form);
      }
      setProfile(updated);
      setEditing(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleFollow() {
    const res = await followApi.toggle(username);
    setIsFollowing(res.following);
    setFollowerCount(res.follower_count);
  }

  // ── Bot actions ────────────────────────────────────────────────────────────

  const isBotAdmin = !!profile?.is_fictitious && (isAdmin || !!localStorage.getItem("_prev_token"));

  async function openActionsPanel() {
    if (!profile?.bot_id) return;
    setShowActions(true);
    if (botData) return;
    setActionsLoading(true);
    setActionsError("");
    try {
      const bots: any[] = await botApi.list();
      const bot = bots.find((b) => b.id === profile.bot_id);
      if (bot) setBotData(bot);
      else setActionsError("Bot no encontrado");
    } catch (err: any) {
      setActionsError(err.message);
    } finally {
      setActionsLoading(false);
    }
  }

  async function handleAddAction() {
    if (!botData) return;
    setAddingAction(true);
    setActionsError("");
    try {
      const pool = newAction.content_pool_raw.split("\n").map((s) => s.trim()).filter(Boolean);
      const updated = await botApi.addAction(botData.id, {
        action_type: newAction.action_type,
        frequency_hours: newAction.frequency_hours,
        content_pool: pool,
      });
      setBotData(updated);
      setNewAction({ action_type: "post", frequency_hours: 6, content_pool_raw: "" });
    } catch (err: any) {
      setActionsError(err.message);
    } finally {
      setAddingAction(false);
    }
  }

  async function handleDeleteAction(actionId: number) {
    if (!botData) return;
    setActionsError("");
    try {
      const updated = await botApi.deleteAction(botData.id, actionId);
      setBotData(updated);
    } catch (err: any) {
      setActionsError(err.message);
    }
  }

  async function handleRunBot() {
    if (!botData) return;
    setRunningBot(true);
    setActionsError("");
    try {
      const res = await botApi.run(botData.id);
      setBotData(res.bot ?? botData);
    } catch (err: any) {
      setActionsError(err.message);
    } finally {
      setRunningBot(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!profile) return (
    <div className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</div>
  );

  const canEdit = isMe || (isAdmin && !!profile.is_fictitious);

  return (
    <div className="min-h-screen bg-hate-dark">
      {/* Navbar */}
      <nav className="bg-hate-gray border-b border-gray-800 px-4 py-3 flex items-center gap-4 sticky top-0 z-20">
        <Link href="/feed" className="text-gray-400 hover:text-white transition text-sm">← Feed</Link>
        <span className="text-xl font-black text-hate-red">HateGram</span>
      </nav>

      <div className="max-w-2xl mx-auto">

        {/* Banner */}
        <div className="relative h-40 bg-gradient-to-br from-hate-gray to-hate-light">
          {profile.banner_url && (
            <img src={profile.banner_url} alt="banner" className="w-full h-full object-cover" />
          )}
          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white text-xs px-3 py-1.5 rounded-full transition"
            >
              {t("edit_profile")}
            </button>
          )}
        </div>

        {/* Avatar */}
        <div className="px-4">
          <div className="flex items-end justify-between" style={{ marginTop: "-48px" }}>
            <div className="relative z-10 w-24 h-24 rounded-full border-4 border-hate-dark overflow-hidden bg-hate-light flex items-center justify-center flex-shrink-0">
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
                : <span className="text-4xl font-black text-hate-red">{profile.display_name[0]}</span>
              }
            </div>
            <div className="flex gap-6 pb-1">
              <div className="text-center">
                <p className="text-white font-bold text-lg leading-none">{profile.following_count}</p>
                <p className="text-gray-500 text-xs mt-0.5">Siguiendo</p>
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-lg leading-none">{followerCount}</p>
                <p className="text-gray-500 text-xs mt-0.5">Seguidores</p>
              </div>
            </div>
          </div>

          {/* Nombre → @username → Bio → Links */}
          <div className="mt-3">
            <h1 className="text-xl font-black text-white">{profile.display_name}</h1>
            <p className="text-gray-500 text-sm mb-2">@{profile.username}</p>
            {profile.bio && (
              <p className="text-gray-300 text-sm leading-relaxed mb-2 whitespace-pre-wrap">{profile.bio}</p>
            )}
            <div className="flex flex-wrap gap-3 text-sm mb-3">
              {profile.location && <span className="text-gray-500">📍 {profile.location}</span>}
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer"
                  className="text-hate-red hover:underline">
                  🔗 {profile.website.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>

            {/* Badges */}
            {profile.badges?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {profile.badges.map((badge) => (
                  <div
                    key={badge.slug}
                    title={`${badge.name}: ${badge.description} (score: ${badge.score})`}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold cursor-default select-none"
                    style={{ borderColor: badge.color, color: badge.color, background: `${badge.color}18` }}
                  >
                    <span>{badge.icon}</span>
                    <span>{badge.name}</span>
                    <span className="opacity-60 font-mono text-xs">·{badge.score}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Follow + Contact (usuarios ajenos no-bot) */}
            {!isMe && !isBotAdmin && (
              <div className="flex gap-2 mb-4">
                <button
                  onClick={handleFollow}
                  className={`flex-1 py-2 rounded-xl font-bold text-sm transition ${
                    isFollowing
                      ? "bg-hate-gray border border-gray-600 text-gray-300 hover:border-hate-red hover:text-hate-red"
                      : "bg-hate-red hover:bg-red-700 text-white"
                  }`}
                >
                  {isFollowing ? "Siguiendo" : "Seguir"}
                </button>
                <Link href={`/messages/${username}`} className="flex-1 py-2 rounded-xl font-bold text-sm bg-hate-gray border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white transition text-center">
                  Contactar
                </Link>
              </div>
            )}

            {/* Botones admin para bots */}
            {isBotAdmin && (
              <div className="flex flex-col gap-2 mb-4">
                <button
                  onClick={() => setEditing(true)}
                  className="w-full py-2 rounded-xl font-bold text-sm bg-hate-gray border border-gray-600 text-gray-300 hover:border-hate-red hover:text-white transition text-left px-4"
                >
                  ✏️ {t("edit_profile")}
                </button>
                <button
                  onClick={showActions ? () => setShowActions(false) : openActionsPanel}
                  className="w-full py-2 rounded-xl font-bold text-sm bg-hate-gray border border-gray-600 text-gray-300 hover:border-hate-red hover:text-white transition text-left px-4"
                >
                  ⚙️ Acciones automáticas {showActions ? "▲" : "▼"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Panel de acciones automáticas ─────────────────────────────── */}
        {isBotAdmin && showActions && (
          <div className="mx-4 mb-4 bg-hate-gray border border-gray-700 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <p className="text-sm font-bold text-white">⚙️ Acciones automáticas</p>
              {profile.is_fictitious && (
                <button
                  onClick={handleRunBot}
                  disabled={runningBot || !botData}
                  className="text-xs bg-hate-red hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                >
                  {runningBot ? "Ejecutando..." : "▶ Ejecutar ahora"}
                </button>
              )}
            </div>

            {actionsLoading ? (
              <div className="py-8 text-center text-gray-500 text-sm">Cargando...</div>
            ) : (
              <div className="p-4 space-y-4">
                {actionsError && (
                  <p className="text-hate-red text-xs">{actionsError}</p>
                )}

                {/* Lista de acciones existentes */}
                {(botData?.actions?.length ?? 0) === 0 ? (
                  <p className="text-gray-600 text-sm text-center py-2">Sin acciones configuradas</p>
                ) : (
                  <div className="space-y-2">
                    {botData.actions.map((a: any) => (
                      <div key={a.id} className="flex items-center gap-3 bg-hate-light rounded-xl px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">
                            {BOT_ACTION_OPTIONS.find((o) => o.value === a.action_type)?.label ?? a.action_type}
                          </p>
                          <p className="text-gray-500 text-xs">
                            Cada {a.frequency_hours}h
                            {a.content_pool?.length > 0 && ` · ${a.content_pool.length} frases`}
                            {a.last_run && ` · Último: ${new Date(a.last_run).toLocaleDateString("es")}`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteAction(a.id)}
                          className="text-gray-600 hover:text-hate-red transition text-lg flex-shrink-0"
                          title="Eliminar acción"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Formulario nueva acción */}
                <div className="border-t border-gray-800 pt-4 space-y-3">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Nueva acción</p>
                  <div className="flex gap-2">
                    <select
                      value={newAction.action_type}
                      onChange={(e) => setNewAction((f) => ({ ...f, action_type: e.target.value }))}
                      className="flex-1 bg-hate-light border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-hate-red"
                    >
                      {BOT_ACTION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1.5 bg-hate-light border border-gray-700 rounded-xl px-3">
                      <input
                        type="number" min={1} max={168}
                        value={newAction.frequency_hours}
                        onChange={(e) => setNewAction((f) => ({ ...f, frequency_hours: Number(e.target.value) }))}
                        className="w-12 bg-transparent text-white text-sm focus:outline-none text-center"
                      />
                      <span className="text-gray-500 text-xs">h</span>
                    </div>
                  </div>

                  {(newAction.action_type === "post") && (
                    <textarea
                      rows={3}
                      value={newAction.content_pool_raw}
                      onChange={(e) => setNewAction((f) => ({ ...f, content_pool_raw: e.target.value }))}
                      placeholder={"Una frase por línea..."}
                      className="w-full bg-hate-light border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-hate-red resize-none placeholder-gray-600"
                    />
                  )}

                  <button
                    onClick={handleAddAction}
                    disabled={addingAction || !botData}
                    className="w-full bg-hate-red hover:bg-red-700 text-white font-bold py-2 rounded-xl transition text-sm disabled:opacity-50"
                  >
                    {addingAction ? "Agregando..." : "+ Agregar acción"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Highlights */}
        <div className="px-4 mb-4">
          <div className="flex gap-4 overflow-x-auto pb-2">
            {HIGHLIGHTS.map((h) => (
              <div key={h.label} className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group">
                <div className="w-16 h-16 rounded-full border-2 border-gray-700 group-hover:border-hate-red transition bg-hate-gray flex items-center justify-center text-2xl">
                  {h.emoji}
                </div>
                <span className="text-gray-500 text-xs group-hover:text-gray-300 transition">{h.label}</span>
              </div>
            ))}
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-700 group-hover:border-hate-red transition bg-hate-gray flex items-center justify-center text-2xl text-gray-600">
                +
              </div>
              <span className="text-gray-600 text-xs">Nuevo</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 mb-0">
          {([
            { key: "photos", label: "Fotos", icon: "⊞" },
            { key: "videos", label: "Videos", icon: "▷" },
            { key: "pinned", label: "Pinned", icon: "📌" },
          ] as { key: ProfileTab; label: string; icon: string }[]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold border-b-2 transition ${
                activeTab === tab.key
                  ? "border-hate-red text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-0 pb-24">
          {activeTab === "videos" ? (
            <div className="text-center py-16 text-gray-600">
              <p className="text-4xl mb-3">▷</p>
              <p className="text-sm">Videos próximamente</p>
            </div>
          ) : activeTab === "pinned" ? (
            pinnedPosts.length === 0 ? (
              <div className="text-center py-16 text-gray-600">
                <p className="text-4xl mb-3">📌</p>
                <p className="text-sm">No hay posts pinneados aún</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-0.5">
                {pinnedPosts.map((post) => {
                  const thumb = post.image_url || post.link_image;
                  return (
                    <div key={post.id} className="aspect-square bg-hate-gray hover:opacity-80 transition cursor-pointer relative overflow-hidden">
                      {thumb ? (
                        <img src={thumb} alt={post.caption} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-hate-light p-2">
                          <p className="text-gray-400 text-xs text-center line-clamp-4">{post.caption}</p>
                        </div>
                      )}
                      <div className="absolute top-1.5 left-1.5 bg-black/60 rounded px-1.5 py-0.5">
                        <span className="text-white text-xs">📌</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            posts.filter(p => p.image_url || p.link_image).length === 0 ? (
              <div className="text-center py-16 text-gray-600">
                <p className="text-4xl mb-3">📷</p>
                <p className="text-sm">{isMe ? t("no_posts") : t("no_posts_other")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-0.5">
                {posts.filter(p => p.image_url || p.link_image).map((post) => {
                  const thumb = post.image_url || post.link_image;
                  return (
                    <div key={post.id} className="aspect-square bg-hate-gray hover:opacity-80 transition cursor-pointer relative overflow-hidden group">
                      {thumb ? (
                        <img src={thumb} alt={post.caption} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-hate-light p-2">
                          <p className="text-gray-400 text-xs text-center line-clamp-4">{post.caption}</p>
                        </div>
                      )}
                      {post.caption && thumb && (
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-end p-2">
                          <p className="text-white text-xs line-clamp-2">{post.caption}</p>
                        </div>
                      )}
                      {post.link_url && (
                        <div className="absolute top-1.5 right-1.5 bg-black/60 rounded px-1.5 py-0.5">
                          <span className="text-white text-xs">🔗</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>

      {isMe && (
        <FAB onPostCreated={() => postApi.byUser(username).then(setPosts).catch(() => {})} />
      )}

      {/* Modal de edición */}
      {editing && (
        <div className="fixed inset-0 bg-black/70 z-30 flex items-end sm:items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-hate-gray rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white text-lg">{t("edit_profile")}</h2>
              <button type="button" onClick={() => setEditing(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>

            {/* Idioma — solo para el propio perfil, no para bots */}
            {isMe && (
              <div className="border-b border-gray-700 pb-4">
                <LanguageSelector value={lang} onChange={changeLang} label={t("language")} />
              </div>
            )}

            {/* Fotos */}
            <div className="space-y-4 border-b border-gray-700 pb-5">
              <ImageUploadField
                label={t("avatar")}
                currentUrl={form.avatar_url}
                onUploaded={(url) => setForm((f) => ({ ...f, avatar_url: url }))}
              />
              <ImageUploadField
                label={t("banner")}
                currentUrl={form.banner_url}
                onUploaded={(url) => setForm((f) => ({ ...f, banner_url: url }))}
              />
            </div>

            {/* Campos de texto */}
            {[
              { label: t("display_name"), key: "display_name", type: "text", multiline: false },
              { label: t("bio"),          key: "bio",          type: "text", multiline: true  },
              { label: t("location"),     key: "location",     type: "text", multiline: false },
              { label: t("website"),      key: "website",      type: "url",  multiline: false },
            ].map(({ label, key, type, multiline }) => (
              <div key={key}>
                <label className="block text-sm text-gray-400 mb-1">{label}</label>
                {multiline ? (
                  <textarea
                    rows={3}
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="w-full bg-hate-light border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-hate-red resize-none"
                  />
                ) : (
                  <input
                    type={type}
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="w-full bg-hate-light border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-hate-red"
                  />
                )}
              </div>
            ))}

            {error && <p className="text-hate-red text-sm">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={saving}
                className="flex-1 bg-hate-red hover:bg-red-700 text-white font-bold py-2.5 rounded-lg transition disabled:opacity-50">
                {saving ? t("saving") : t("save")}
              </button>
              <button type="button" onClick={() => setEditing(false)}
                className="flex-1 border border-gray-600 text-gray-400 hover:text-white py-2.5 rounded-lg transition">
                {t("cancel")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
