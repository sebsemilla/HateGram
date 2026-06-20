"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { adminApi, botApi, apiFetch } from "@/lib/api";

type Section = "dashboard" | "reports" | "users" | "bots" | "perfiles";

const REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  acoso: "Acoso",
  contenido_inapropiado: "Contenido inapropiado",
  discurso_de_odio: "Discurso de odio",
  desinformacion: "Desinformación",
  violencia: "Violencia",
  otro: "Otro",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-400/10",
  resolved: "text-green-400 bg-green-400/10",
  dismissed: "text-gray-400 bg-gray-400/10",
};

export default function AdminPage() {
  const router = useRouter();
  const [section, setSection] = useState<Section>("dashboard");
  const [stats, setStats] = useState<any>(null);
  const [apiKeys, setApiKeys] = useState<any>(null);
  const [apiKeysForm, setApiKeysForm] = useState({ youtube_api_key: "", gemini_api_key: "" });
  const [apiKeysSaving, setApiKeysSaving] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [reportFilter, setReportFilter] = useState("pending");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Bots
  const [bots, setBots] = useState<any[]>([]);
  const [botForm, setBotForm] = useState({
    mode: "single" as "single" | "batch",
    display_name: "",
    name_prefix: "Bot",
    count: 5,
    bio: "",
    location: "",
    website: "",
    avatar_url: "",
    content_pool_raw: "",
    actions: [{ action_type: "post", frequency_hours: 6 }] as { action_type: string; frequency_hours: number }[],
  });
  const [selectedBotId, setSelectedBotId] = useState<number | null>(null);
  const [botPosting, setBotPosting] = useState(false);
  const [botError, setBotError] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ display_name: "", bio: "", location: "", website: "", avatar_url: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [runningBot, setRunningBot] = useState(false);
  const [runResults, setRunResults] = useState<any[]>([]);
  const [durationDays, setDurationDays] = useState<number>(0);
  const [actionEdits, setActionEdits] = useState<Record<number, { gemini_prompt: string; frequency_hours: number }>>({});

  const selectedBot = bots.find((b) => b.id === selectedBotId) ?? null;

  const ACTION_OPTIONS = [
    { value: "youtube_post", label: "📺 Postear desde YouTube" },
    { value: "post",         label: "✍️ Publicar post (frases)" },
    { value: "vote_truth",   label: "✅ Votar Truth" },
    { value: "vote_fake",    label: "❌ Votar Fake" },
    { value: "vote_for",     label: "👍 Votar A Favor (debate)" },
    { value: "vote_against", label: "👎 Votar En Contra (debate)" },
  ];

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.replace("/login"); return; }
    adminApi.stats()
      .then(setStats)
      .catch(() => router.replace("/feed"));
    apiFetch("/admin/api-keys").then(setApiKeys).catch(() => {});
  }, [router]);

  useEffect(() => {
    if (section === "reports") {
      setLoading(true);
      adminApi.reports(reportFilter).then(setReports).finally(() => setLoading(false));
    } else if (section === "users") {
      setLoading(true);
      adminApi.users().then(setUsers).finally(() => setLoading(false));
    } else if (section === "bots") {
      setLoading(true);
      botApi.list().then(setBots).finally(() => setLoading(false));
    } else if (section === "perfiles") {
      setLoading(true);
      adminApi.users().then(setUsers).finally(() => setLoading(false));
    }
  }, [section, reportFilter]);

  async function handleReportAction(id: number, status: "resolved" | "dismissed") {
    await adminApi.updateReport(id, status);
    setReports((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleDeletePost(reportId: number, postId: number) {
    if (!confirm("¿Eliminar este post?")) return;
    await adminApi.deletePost(postId);
    await adminApi.updateReport(reportId, "resolved");
    setReports((prev) => prev.filter((r) => r.id !== reportId));
  }

  async function handleBanUser(reportId: number, userId: number) {
    if (!confirm("¿Desactivar (banear) este usuario?")) return;
    await adminApi.toggleUser(userId);
    await adminApi.updateReport(reportId, "resolved");
    setReports((prev) => prev.filter((r) => r.id !== reportId));
  }

  async function handleImpersonate(id: number) {
    const res = await adminApi.impersonate(id);
    // Guardar token y user del perfil destino
    const prev = { token: localStorage.getItem("token"), user: localStorage.getItem("user") };
    localStorage.setItem("_prev_token", prev.token || "");
    localStorage.setItem("_prev_user", prev.user || "");
    localStorage.setItem("token", res.access_token);
    localStorage.setItem("user", JSON.stringify({
      username: res.username,
      display_name: res.display_name,
      avatar_url: res.avatar_url,
      is_admin: res.is_admin,
    }));
    window.location.href = "/feed";
  }

  async function handleToggleUser(id: number) {
    const updated = await adminApi.toggleUser(id);
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, is_active: updated.is_active } : u));
  }

  async function handleBotCreate() {
    setBotError("");
    setBotPosting(true);
    const content_pool = botForm.content_pool_raw
      .split("\n").map((s) => s.trim()).filter(Boolean);
    try {
      if (botForm.mode === "single") {
        if (!botForm.display_name.trim()) { setBotError("Nombre requerido"); setBotPosting(false); return; }
        const bot = await botApi.create({
          display_name: botForm.display_name,
          bio: botForm.bio,
          location: botForm.location,
          website: botForm.website,
          avatar_url: botForm.avatar_url,
          template: "custom",
          content_pool,
        });
        // Add each configured action
        for (const a of botForm.actions) {
          await botApi.addAction(bot.id, { ...a, content_pool });
        }
        const updated = await botApi.list();
        setBots(updated);
        setSelectedBotId(bot.id);
      } else {
        if (!botForm.name_prefix.trim()) { setBotError("Prefijo requerido"); setBotPosting(false); return; }
        const res = await botApi.createBatch({
          template: "custom",
          count: botForm.count,
          name_prefix: botForm.name_prefix,
          bio: botForm.bio,
          location: botForm.location,
          website: botForm.website,
          content_pool,
        });
        // Add actions to each created bot
        for (const createdBot of (res.bots ?? [])) {
          for (const a of botForm.actions) {
            await botApi.addAction(createdBot.id, { ...a, content_pool });
          }
        }
        const updated = await botApi.list();
        setBots(updated);
        if (res.bots?.length) setSelectedBotId(res.bots[0].id);
      }
      setBotForm((f) => ({ ...f, display_name: "", bio: "", location: "", website: "", avatar_url: "", content_pool_raw: "" }));
    } catch (err: any) {
      setBotError(err.message);
    } finally {
      setBotPosting(false);
    }
  }

  async function handleApiKeysSave() {
    setApiKeysSaving(true);
    try {
      const res = await botApi.updateApiKeys(apiKeysForm);
      setApiKeys(res);
      setApiKeysForm({ youtube_api_key: "", gemini_api_key: "" });
    } finally {
      setApiKeysSaving(false);
    }
  }

  async function handleProfileSave() {
    if (!selectedBot) return;
    if (!profileForm.display_name.trim()) {
      setProfileError("El nombre no puede estar vacío");
      return;
    }
    setProfileSaving(true);
    setProfileError("");
    try {
      const payload: Record<string, string> = { display_name: profileForm.display_name };
      if (profileForm.bio      !== undefined) payload.bio       = profileForm.bio;
      if (profileForm.location !== undefined) payload.location  = profileForm.location;
      if (profileForm.website  !== undefined) payload.website   = profileForm.website;
      if (profileForm.avatar_url !== undefined) payload.avatar_url = profileForm.avatar_url;
      const updated = await botApi.updateProfile(selectedBot.id, payload);
      setBots((prev) => prev.map((b) => b.id === updated.id ? updated : b));
      setEditingProfile(false);
    } catch (err: any) {
      setProfileError(err.message || "Error al guardar perfil");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleBotToggle(id: number) {
    const res = await botApi.toggle(id);
    setBots((prev) => prev.map((b) => b.id === id ? { ...b, is_active: res.is_active } : b));
  }

  async function handleBotRun(id: number) {
    setRunningBot(true);
    setRunResults([]);
    try {
      const res = await botApi.run(id);
      setRunResults(res.results ?? []);
      setBots((prev) => prev.map((b) => b.id === res.bot?.id ? res.bot : b));
    } catch (err: any) {
      setRunResults([{ status: "error", detail: err.message }]);
    } finally {
      setRunningBot(false);
    }
  }

  async function handleDurationSave(id: number) {
    const res = await botApi.update(id, { duration_days: durationDays });
    setBots((prev) => prev.map((b) => b.id === res.id ? res : b));
  }

  async function handleActionSave(botId: number, actionId: number) {
    const edits = actionEdits[actionId];
    if (!edits) return;
    const res = await botApi.updateAction(botId, actionId, edits);
    setBots((prev) => prev.map((b) => b.id === res.id ? res : b));
  }

  async function handleBotDelete(id: number) {
    if (!confirm("¿Eliminar este bot y su usuario?")) return;
    await botApi.delete(id);
    setBots((prev) => prev.filter((b) => b.id !== id));
    if (selectedBotId === id) setSelectedBotId(null);
  }

  const navItems: { key: Section; label: string; icon: string }[] = [
    { key: "dashboard", label: "Dashboard",   icon: "📊" },
    { key: "reports",   label: "Reportes",    icon: "🚨" },
    { key: "users",     label: "Usuarios",    icon: "👥" },
    { key: "bots",      label: "Bots",        icon: "🤖" },
    { key: "perfiles",  label: "Mis Perfiles", icon: "🪪" },
  ];

  return (
    <div className="min-h-screen bg-hate-dark flex flex-col">
      {/* Navbar */}
      <nav className="bg-hate-gray border-b border-gray-800 px-4 py-3 flex items-center gap-4 sticky top-0 z-20">
        <Link href="/feed" className="text-gray-400 hover:text-white text-sm transition">← Feed</Link>
        <span className="text-xl font-black bg-gradient-to-r from-cyan-400 to-fuchsia-600 bg-clip-text text-transparent">feedpod</span>
        <span className="text-gray-600 text-sm">/ Admin</span>
      </nav>

      <div className="flex flex-1 w-full">
        {/* Sidebar */}
        <aside className="w-48 border-r border-gray-800 p-4 space-y-1 flex-shrink-0">
          {navItems.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition text-left ${
                section === key
                  ? "bg-hate-red text-white"
                  : "text-gray-400 hover:text-white hover:bg-hate-gray"
              }`}
            >
              <span>{icon}</span> {label}
              {key === "reports" && stats?.pending_reports > 0 && (
                <span className="ml-auto bg-hate-red text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {stats.pending_reports}
                </span>
              )}
            </button>
          ))}
        </aside>

        {/* Content */}
        <main className="flex-1 p-6 overflow-y-auto">

          {/* ── Dashboard ── */}
          {section === "dashboard" && (
            <div>
              <h1 className="text-2xl font-black text-white mb-6">Dashboard</h1>
              {stats ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    { label: "Usuarios totales", value: stats.total_users, icon: "👤" },
                    { label: "Usuarios activos", value: stats.active_users, icon: "✅" },
                    { label: "Posts totales", value: stats.total_posts, icon: "📷" },
                    { label: "Reportes pendientes", value: stats.pending_reports, icon: "🚨", highlight: stats.pending_reports > 0 },
                    { label: "Reportes totales", value: stats.total_reports, icon: "📋" },
                  ].map(({ label, value, icon, highlight }) => (
                    <div key={label} className={`bg-hate-gray rounded-xl p-5 border ${highlight ? "border-hate-red" : "border-gray-800"}`}>
                      <p className="text-2xl mb-1">{icon}</p>
                      <p className={`text-3xl font-black ${highlight ? "text-hate-red" : "text-white"}`}>{value}</p>
                      <p className="text-gray-500 text-sm mt-1">{label}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">Cargando estadísticas...</p>
              )}

              {/* API Keys */}
              <div className="mt-8 bg-hate-gray rounded-2xl border border-gray-800 p-5 max-w-lg">
                <h2 className="text-white font-bold mb-1">API Keys</h2>
                <p className="text-gray-500 text-xs mb-4">
                  Las keys se aplican en memoria inmediatamente. Para hacerlas permanentes, ponelas en <code className="text-gray-400">docker-compose.yml</code> y hacé rebuild.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 flex items-center gap-2">
                      YouTube Data API v3
                      {apiKeys?.youtube_configured
                        ? <span className="text-green-400 font-bold">● Configurada</span>
                        : <span className="text-gray-600">● Sin configurar</span>}
                    </label>
                    <input type="password" value={apiKeysForm.youtube_api_key}
                      onChange={(e) => setApiKeysForm((f) => ({ ...f, youtube_api_key: e.target.value }))}
                      placeholder="AIza..."
                      className="w-full bg-hate-light border border-gray-700 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-hate-red font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 flex items-center gap-2">
                      Gemini API
                      {apiKeys?.gemini_configured
                        ? <span className="text-green-400 font-bold">● Configurada</span>
                        : <span className="text-gray-600">● Sin configurar</span>}
                    </label>
                    <input type="password" value={apiKeysForm.gemini_api_key}
                      onChange={(e) => setApiKeysForm((f) => ({ ...f, gemini_api_key: e.target.value }))}
                      placeholder="AIza..."
                      className="w-full bg-hate-light border border-gray-700 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-hate-red font-mono"
                    />
                  </div>
                  <button onClick={handleApiKeysSave} disabled={apiKeysSaving || (!apiKeysForm.youtube_api_key && !apiKeysForm.gemini_api_key)}
                    className="bg-hate-red hover:bg-red-700 text-white font-bold px-5 py-2 rounded-xl text-sm transition disabled:opacity-40"
                  >
                    {apiKeysSaving ? "Guardando..." : "Guardar keys"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Reportes ── */}
          {section === "reports" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-black text-white">Reportes</h1>
                <div className="flex gap-2">
                  {["pending", "resolved", "dismissed"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setReportFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        reportFilter === f ? "bg-hate-red text-white" : "bg-hate-gray text-gray-400 hover:text-white"
                      }`}
                    >
                      {f === "pending" ? "Pendientes" : f === "resolved" ? "Resueltos" : "Descartados"}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <p className="text-gray-500 text-sm">Cargando...</p>
              ) : reports.length === 0 ? (
                <div className="text-center py-16 text-gray-600">
                  <p className="text-4xl mb-3">✅</p>
                  <p className="text-sm">No hay reportes en esta categoría</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map((r) => (
                    <div key={r.id} className="bg-hate-gray rounded-xl p-4 border border-gray-800">
                      {/* Header del reporte */}
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status]}`}>
                              {r.status === "pending" ? "Pendiente" : r.status === "resolved" ? "Resuelto" : "Descartado"}
                            </span>
                            <span className="text-xs bg-hate-light text-gray-300 px-2 py-0.5 rounded-full">
                              {REASON_LABELS[r.reason] || r.reason}
                            </span>
                            {r.reported_user && !r.reported_user_active && (
                              <span className="text-xs bg-red-900/40 text-red-400 px-2 py-0.5 rounded-full">Usuario baneado</span>
                            )}
                          </div>
                          <p className="text-white text-sm">
                            <span className="text-hate-red font-semibold">@{r.reporter}</span>
                            {" reportó a "}
                            <span className="font-semibold">
                              {r.reported_user ? `@${r.reported_user}` : `post #${r.reported_post_id}`}
                            </span>
                          </p>
                          {r.description && (
                            <p className="text-gray-400 text-sm mt-1 italic">"{r.description}"</p>
                          )}
                          <p className="text-gray-600 text-xs mt-1">
                            {new Date(r.created_at).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>

                      {/* Contenido del post reportado */}
                      {r.reported_post_id && (
                        <div className="bg-hate-light rounded-lg p-3 mb-3 border border-gray-700">
                          {!r.reported_post_exists ? (
                            <p className="text-gray-600 text-xs italic">Post eliminado</p>
                          ) : (
                            <>
                              {r.reported_post_image && (
                                <img src={r.reported_post_image.startsWith("http") ? r.reported_post_image : `http://localhost:8000${r.reported_post_image}`}
                                  className="w-full max-h-40 object-cover rounded-lg mb-2" />
                              )}
                              {r.reported_post_caption && (
                                <p className="text-gray-300 text-sm line-clamp-3">{r.reported_post_caption}</p>
                              )}
                              {!r.reported_post_caption && !r.reported_post_image && (
                                <p className="text-gray-600 text-xs italic">Post sin texto ni imagen</p>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {/* Acciones */}
                      {r.status === "pending" && (
                        <div className="flex gap-2 flex-wrap">
                          {r.reported_post_id && r.reported_post_exists && (
                            <button
                              onClick={() => handleDeletePost(r.id, r.reported_post_id)}
                              className="text-xs bg-red-900/30 hover:bg-red-900/60 text-red-400 px-3 py-1.5 rounded-lg transition font-semibold"
                            >
                              🗑 Eliminar post
                            </button>
                          )}
                          {r.reported_user_id && r.reported_user_active && (
                            <button
                              onClick={() => handleBanUser(r.id, r.reported_user_id)}
                              className="text-xs bg-orange-900/30 hover:bg-orange-900/60 text-orange-400 px-3 py-1.5 rounded-lg transition font-semibold"
                            >
                              🔨 Banear usuario
                            </button>
                          )}
                          <button
                            onClick={() => handleReportAction(r.id, "resolved")}
                            className="text-xs bg-green-500/20 hover:bg-green-500/40 text-green-400 px-3 py-1.5 rounded-lg transition font-semibold"
                          >
                            ✓ Resolver
                          </button>
                          <button
                            onClick={() => handleReportAction(r.id, "dismissed")}
                            className="text-xs bg-gray-500/20 hover:bg-gray-500/40 text-gray-400 px-3 py-1.5 rounded-lg transition font-semibold"
                          >
                            Descartar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Usuarios ── */}
          {section === "users" && (
            <div>
              <h1 className="text-2xl font-black text-white mb-6">Usuarios</h1>
              {loading ? (
                <p className="text-gray-500 text-sm">Cargando...</p>
              ) : (
                <div className="space-y-2">
                  {users.map((u) => (
                    <div key={u.id} className={`bg-hate-gray rounded-xl p-4 border flex items-center gap-4 ${!u.is_active ? "opacity-50 border-gray-800" : "border-gray-800"}`}>
                      <div className="w-10 h-10 rounded-full bg-hate-light overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {u.avatar_url
                          ? <img src={u.avatar_url} alt={u.username} className="w-full h-full object-cover" />
                          : <span className="text-hate-red font-black">{u.display_name[0]}</span>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white font-semibold text-sm">{u.display_name}</p>
                          {u.is_admin && <span className="text-xs bg-hate-red/20 text-hate-red px-1.5 py-0.5 rounded">Admin</span>}
                          {u.is_fictitious && <span className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">Ficticio</span>}
                          {!u.is_active && <span className="text-xs bg-red-900/40 text-red-400 px-1.5 py-0.5 rounded">Inactivo</span>}
                        </div>
                        <p className="text-gray-500 text-xs">@{u.username} · {u.email}</p>
                        <p className="text-gray-600 text-xs">Desde {new Date(u.created_at).toLocaleDateString("es")}</p>
                      </div>
                      {!u.is_admin && (
                        <button
                          onClick={() => handleToggleUser(u.id)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition flex-shrink-0 ${
                            u.is_active
                              ? "bg-red-500/20 hover:bg-red-500/40 text-red-400"
                              : "bg-green-500/20 hover:bg-green-500/40 text-green-400"
                          }`}
                        >
                          {u.is_active ? "Desactivar" : "Activar"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Bots ── */}
          {section === "bots" && (
            <div className="flex gap-0 -m-6 h-[calc(100vh-57px)]">

              {/* ── Columna izquierda: formulario ── */}
              <div className="flex-1 border-r border-gray-800 flex flex-col overflow-y-auto min-w-0">
                <div className="p-5 space-y-4">
                  <h2 className="text-white font-black text-lg">Nuevo bot</h2>

                  {/* Single / Batch */}
                  <div className="flex gap-1.5 bg-hate-light rounded-xl p-1">
                    {(["single", "batch"] as const).map((m) => (
                      <button key={m} type="button"
                        onClick={() => setBotForm((f) => ({ ...f, mode: m }))}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                          botForm.mode === m ? "bg-hate-red text-white" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        {m === "single" ? "Individual" : "En lote"}
                      </button>
                    ))}
                  </div>

                  {/* Nombre / Prefijo */}
                  {botForm.mode === "single" ? (
                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block">Nombre</label>
                      <input type="text" value={botForm.display_name}
                        onChange={(e) => setBotForm((f) => ({ ...f, display_name: e.target.value }))}
                        placeholder="Ej: María Torres"
                        className="w-full bg-hate-light border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-hate-red"
                      />
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-gray-400 mb-1.5 block">Prefijo</label>
                        <input type="text" value={botForm.name_prefix}
                          onChange={(e) => setBotForm((f) => ({ ...f, name_prefix: e.target.value }))}
                          className="w-full bg-hate-light border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-hate-red"
                        />
                      </div>
                      <div className="w-20">
                        <label className="text-xs text-gray-400 mb-1.5 block">Cantidad</label>
                        <input type="number" min={1} max={50} value={botForm.count}
                          onChange={(e) => setBotForm((f) => ({ ...f, count: Number(e.target.value) }))}
                          className="w-full bg-hate-light border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-hate-red"
                        />
                      </div>
                    </div>
                  )}

                  {/* Acciones */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-gray-400">Acciones</label>
                      <button type="button"
                        onClick={() => setBotForm((f) => ({ ...f, actions: [...f.actions, { action_type: "vote_truth", frequency_hours: 4 }] }))}
                        className="text-xs text-hate-red hover:text-red-400 font-bold transition"
                      >
                        + Agregar
                      </button>
                    </div>
                    <div className="space-y-2">
                      {botForm.actions.map((a, i) => (
                        <div key={i} className="bg-hate-light rounded-xl p-3 flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <select
                              value={a.action_type}
                              onChange={(e) => setBotForm((f) => {
                                const actions = [...f.actions] as any[];
                                actions[i] = { ...actions[i], action_type: e.target.value };
                                return { ...f, actions };
                              })}
                              className="flex-1 bg-hate-gray border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-hate-red"
                            >
                              {ACTION_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                            {botForm.actions.length > 1 && (
                              <button type="button"
                                onClick={() => setBotForm((f) => ({ ...f, actions: f.actions.filter((_, j) => j !== i) }))}
                                className="text-gray-600 hover:text-hate-red text-sm transition"
                              >✕</button>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 text-xs">Cada</span>
                            <input type="number" min={0.5} step={0.5} value={a.frequency_hours}
                              onChange={(e) => setBotForm((f) => {
                                const actions = [...f.actions] as any[];
                                actions[i] = { ...actions[i], frequency_hours: Number(e.target.value) };
                                return { ...f, actions };
                              })}
                              className="w-16 bg-hate-gray border border-gray-700 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-hate-red text-center"
                            />
                            <span className="text-gray-500 text-xs">horas</span>
                          </div>

                          {/* Campos extra para youtube_post */}
                          {(a as any).action_type === "youtube_post" && (
                            <div className="space-y-2 pt-1 border-t border-gray-700/50">
                              <input type="text"
                                value={(a as any).youtube_channel_id || ""}
                                onChange={(e) => setBotForm((f) => {
                                  const actions = [...f.actions] as any[];
                                  actions[i] = { ...actions[i], youtube_channel_id: e.target.value };
                                  return { ...f, actions };
                                })}
                                placeholder="Channel ID — ej: UCxxxxxxxxxxxxxx"
                                className="w-full bg-hate-gray border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-hate-red font-mono"
                              />
                              <textarea rows={2}
                                value={(a as any).gemini_prompt || ""}
                                onChange={(e) => setBotForm((f) => {
                                  const actions = [...f.actions] as any[];
                                  actions[i] = { ...actions[i], gemini_prompt: e.target.value };
                                  return { ...f, actions };
                                })}
                                placeholder="Prompt para Gemini (vacío = predeterminado). Ej: Comentá este video con tono crítico, en español, máximo 1 oración."
                                className="w-full bg-hate-gray border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-hate-red resize-none placeholder-gray-600"
                              />
                              <p className="text-gray-600 text-xs">
                                El Channel ID se encuentra en la URL del canal o en Configuración de YouTube Studio.
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Perfil */}
                  <div className="space-y-2">
                    <label className="text-xs text-gray-400 block">Perfil</label>

                    {/* Avatar URL o auto */}
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Avatar URL <span className="text-gray-700">(vacío = auto-generado)</span></p>
                      <div className="flex gap-2 items-center">
                        {(botForm.avatar_url || botForm.display_name) && (
                          <img
                            src={botForm.avatar_url || `https://api.dicebear.com/9.x/avataaars/svg?seed=${botForm.display_name || botForm.name_prefix}&backgroundColor=b6e3f4`}
                            className="w-10 h-10 rounded-full bg-hate-light flex-shrink-0"
                            alt="preview"
                          />
                        )}
                        <input type="url" value={botForm.avatar_url}
                          onChange={(e) => setBotForm((f) => ({ ...f, avatar_url: e.target.value }))}
                          placeholder="https://... (opcional)"
                          className="flex-1 bg-hate-light border border-gray-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-hate-red"
                        />
                      </div>
                    </div>

                    <textarea rows={2} value={botForm.bio}
                      onChange={(e) => setBotForm((f) => ({ ...f, bio: e.target.value }))}
                      placeholder="Bio del bot..."
                      className="w-full bg-hate-light border border-gray-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-hate-red resize-none placeholder-gray-600"
                    />
                    <div className="flex gap-2">
                      <input type="text" value={botForm.location}
                        onChange={(e) => setBotForm((f) => ({ ...f, location: e.target.value }))}
                        placeholder="Ubicación"
                        className="flex-1 bg-hate-light border border-gray-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-hate-red"
                      />
                      <input type="text" value={botForm.website}
                        onChange={(e) => setBotForm((f) => ({ ...f, website: e.target.value }))}
                        placeholder="Website"
                        className="flex-1 bg-hate-light border border-gray-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-hate-red"
                      />
                    </div>
                  </div>

                  {/* Pool de frases */}
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">Frases — una por línea</label>
                    <textarea rows={5} value={botForm.content_pool_raw}
                      onChange={(e) => setBotForm((f) => ({ ...f, content_pool_raw: e.target.value }))}
                      placeholder={"¿Alguien verificó esto?\nNo me sorprende.\nHay que hablar de esto."}
                      className="w-full bg-hate-light border border-gray-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-hate-red resize-none placeholder-gray-600 font-mono"
                    />
                    <p className="text-gray-600 text-xs mt-1">El bot elige una al azar cada vez que postea.</p>
                  </div>

                  {botError && <p className="text-hate-red text-xs">{botError}</p>}

                  <button type="button" onClick={handleBotCreate} disabled={botPosting}
                    className="w-full bg-hate-red hover:bg-red-700 text-white font-bold py-2.5 rounded-xl transition disabled:opacity-50 text-sm"
                  >
                    {botPosting ? "Creando..." : botForm.mode === "single" ? "Crear bot" : `Crear ${botForm.count} bots`}
                  </button>
                </div>
              </div>

              {/* ── Columna lista de bots (300px fija) ── */}
              <div className="w-[300px] flex-shrink-0 flex flex-col overflow-hidden border-l border-gray-800">

                {/* Header de la lista */}
                <div className="border-b border-gray-800 px-4 py-2.5 flex-shrink-0 bg-hate-gray/50">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">
                    {bots.length} bot{bots.length !== 1 ? "s" : ""}
                  </p>
                </div>

                {/* Lista scrolleable */}
                <div className="flex-1 overflow-y-auto">
                  {loading ? (
                    <div className="flex items-center justify-center h-40 text-gray-600 text-sm">Cargando...</div>
                  ) : bots.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-700 gap-2">
                      <p className="text-4xl">🤖</p>
                      <p className="text-sm">No hay bots todavía</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-800/50">
                      {bots.map((b) => (
                        <button
                          key={b.id}
                          onClick={() => {
                            const nextId = b.id === selectedBotId ? null : b.id;
                            setSelectedBotId(nextId);
                            setEditingProfile(false);
                            setRunResults([]);
                            if (nextId) {
                              setDurationDays(0);
                              const edits: Record<number, { gemini_prompt: string; frequency_hours: number }> = {};
                              b.actions.forEach((a: any) => {
                                edits[a.id] = { gemini_prompt: a.gemini_prompt || "", frequency_hours: a.frequency_hours };
                              });
                              setActionEdits(edits);
                            }
                          }}
                          className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${
                            b.id === selectedBotId
                              ? "bg-hate-red/10 border-l-2 border-hate-red"
                              : "hover:bg-hate-gray border-l-2 border-transparent"
                          } ${!b.is_active ? "opacity-40" : ""}`}
                        >
                          <img
                            src={b.avatar_url}
                            className="w-9 h-9 rounded-full bg-hate-light flex-shrink-0 object-cover"
                            alt={b.display_name}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-white font-semibold text-sm truncate">{b.display_name}</p>
                              {!b.is_active && (
                                <span className="text-xs bg-gray-800 text-gray-500 px-1 py-0.5 rounded flex-shrink-0">off</span>
                              )}
                            </div>
                            <p className="text-gray-500 text-xs truncate">
                              {b.actions.map((a: any) => a.action_label).join(", ") || "Sin acciones"}
                            </p>
                          </div>
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${b.is_active ? "bg-green-500" : "bg-gray-700"}`} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Panel lateral: detalle + edición del bot seleccionado ── */}
              {selectedBot && (
                <div className="w-[320px] flex-shrink-0 flex flex-col overflow-hidden border-l border-gray-800 bg-hate-gray/30">

                  {/* Header con avatar, nombre y botones */}
                  <div className="border-b border-gray-800 px-4 py-3 flex-shrink-0 bg-hate-gray">
                    <div className="flex items-center gap-3 mb-2.5">
                      <img src={selectedBot.avatar_url} className="w-10 h-10 rounded-full object-cover flex-shrink-0" alt="" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm truncate">{selectedBot.display_name}</p>
                        <p className="text-gray-500 text-xs">@{selectedBot.username}</p>
                      </div>
                      <button onClick={() => { setSelectedBotId(null); setEditingProfile(false); }}
                        className="text-gray-600 hover:text-gray-400 transition text-lg leading-none">✕</button>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleBotRun(selectedBot.id)}
                        disabled={runningBot}
                        className="flex-1 text-xs py-1.5 rounded-lg font-bold bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 transition disabled:opacity-40"
                      >
                        {runningBot ? "..." : "▶ Iniciar"}
                      </button>
                      <button
                        onClick={() => handleBotToggle(selectedBot.id)}
                        className={`flex-1 text-xs py-1.5 rounded-lg font-bold transition ${
                          selectedBot.is_active
                            ? "bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-400"
                            : "bg-green-500/20 hover:bg-green-500/40 text-green-400"
                        }`}
                      >
                        {selectedBot.is_active ? "⏸ Pausar" : "⏺ Activar"}
                      </button>
                      <button
                        onClick={() => handleBotDelete(selectedBot.id)}
                        className="flex-1 text-xs py-1.5 rounded-lg font-bold bg-red-500/20 hover:bg-red-500/40 text-red-400 transition"
                      >
                        🗑
                      </button>
                    </div>
                  </div>

                  {/* Contenido scrolleable */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">

                    {/* Perfil — sección plegable */}
                    <div className="border border-gray-800 rounded-xl overflow-hidden">
                      <button
                        onClick={() => {
                          setEditingProfile((v) => !v);
                          if (!editingProfile) {
                            setProfileForm({
                              display_name: selectedBot.display_name,
                              bio: selectedBot.bio || "",
                              location: selectedBot.location || "",
                              website: selectedBot.website || "",
                              avatar_url: selectedBot.avatar_url || "",
                            });
                          }
                        }}
                        className="w-full flex items-center justify-between px-3 py-2.5 bg-hate-light hover:bg-gray-700/50 transition"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-hate-gray border border-gray-600 flex items-center justify-center text-xs">✏️</span>
                          <span className="text-xs text-gray-300 font-semibold uppercase tracking-wide">Perfil</span>
                        </div>
                        <span className="text-gray-500 text-xs">{editingProfile ? "▲" : "▼"}</span>
                      </button>

                      {editingProfile && (
                        <div className="p-3 space-y-3 border-t border-gray-800">
                          <div className="flex gap-3 items-start">
                            <img src={profileForm.avatar_url || selectedBot.avatar_url}
                              className="w-10 h-10 rounded-full bg-hate-light flex-shrink-0 object-cover" alt="" />
                            <div className="flex-1 space-y-2">
                              <input type="text" value={profileForm.display_name}
                                onChange={(e) => { setProfileError(""); setProfileForm((f) => ({ ...f, display_name: e.target.value })); }}
                                placeholder="Nombre"
                                className="w-full bg-hate-gray border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-hate-red"
                              />
                              <input type="url" value={profileForm.avatar_url}
                                onChange={(e) => setProfileForm((f) => ({ ...f, avatar_url: e.target.value }))}
                                placeholder="URL de avatar (vacío = auto)"
                                className="w-full bg-hate-gray border border-gray-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-hate-red"
                              />
                            </div>
                          </div>
                          <textarea rows={2} value={profileForm.bio}
                            onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))}
                            placeholder="Bio..."
                            className="w-full bg-hate-gray border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-hate-red resize-none placeholder-gray-600"
                          />
                          <div className="flex gap-2">
                            <input type="text" value={profileForm.location}
                              onChange={(e) => setProfileForm((f) => ({ ...f, location: e.target.value }))}
                              placeholder="Ubicación"
                              className="flex-1 bg-hate-gray border border-gray-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-hate-red"
                            />
                            <input type="text" value={profileForm.website}
                              onChange={(e) => setProfileForm((f) => ({ ...f, website: e.target.value }))}
                              placeholder="Website"
                              className="flex-1 bg-hate-gray border border-gray-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-hate-red"
                            />
                          </div>
                          {profileError && (
                            <p className="text-hate-red text-xs">{profileError}</p>
                          )}
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => { setEditingProfile(false); setProfileError(""); }}
                              className="text-xs text-gray-500 hover:text-white px-3 py-1.5 rounded-lg transition">
                              Cancelar
                            </button>
                            <button onClick={handleProfileSave} disabled={profileSaving}
                              className="text-xs bg-hate-red hover:bg-red-700 text-white font-bold px-4 py-1.5 rounded-lg transition disabled:opacity-50">
                              {profileSaving ? "Guardando..." : "Guardar"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Duración */}
                    <div className="bg-hate-light rounded-xl px-3 py-2.5 space-y-2">
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Duración</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number" min={0} value={durationDays}
                          onChange={(e) => setDurationDays(Number(e.target.value))}
                          placeholder="0"
                          className="w-16 bg-hate-gray border border-gray-700 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-hate-red text-center"
                        />
                        <span className="text-gray-500 text-xs">días (0 = sin límite)</span>
                        <button onClick={() => handleDurationSave(selectedBot.id)}
                          className="ml-auto text-xs bg-hate-red/20 hover:bg-hate-red/40 text-hate-red px-3 py-1 rounded-lg font-bold transition">
                          Guardar
                        </button>
                      </div>
                      {selectedBot.active_until && (
                        <p className="text-xs text-yellow-500">
                          Expira: {new Date(selectedBot.active_until).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      )}
                    </div>

                    {/* Resultado del último Iniciar */}
                    {runResults.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Resultado</p>
                        {runResults.map((r, i) => (
                          <div key={i} className={`text-xs px-3 py-1.5 rounded-lg ${r.status === "ok" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                            {r.action_type && <span className="font-mono mr-2">{r.action_type}</span>}
                            {r.status === "ok" ? "✓ ejecutado" : `✗ ${r.detail || r.status}`}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Acciones */}
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Acciones</p>
                      {selectedBot.actions.length === 0 ? (
                        <p className="text-gray-600 text-xs">Sin acciones configuradas</p>
                      ) : selectedBot.actions.map((a: any) => {
                        const edit = actionEdits[a.id] ?? { gemini_prompt: a.gemini_prompt || "", frequency_hours: a.frequency_hours };
                        return (
                          <div key={a.id} className="bg-hate-light rounded-xl px-3 py-3 space-y-3">
                            <p className="text-white text-xs font-bold">{a.action_label}</p>

                            {/* Periodicidad */}
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 text-xs w-20">Periodicidad</span>
                              <input type="number" min={0.5} step={0.5}
                                value={edit.frequency_hours}
                                onChange={(e) => setActionEdits((prev) => ({ ...prev, [a.id]: { ...edit, frequency_hours: Number(e.target.value) } }))}
                                className="w-14 bg-hate-gray border border-gray-700 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-hate-red text-center"
                              />
                              <span className="text-gray-500 text-xs">horas</span>
                            </div>

                            {/* Canal YouTube si aplica */}
                            {a.youtube_channel_id && (
                              <p className="text-gray-400 text-xs font-mono truncate">📺 {a.youtube_channel_id}</p>
                            )}

                            {/* Prompt Gemini */}
                            <div className="space-y-1">
                              <p className="text-xs text-gray-500">Prompt</p>
                              <textarea rows={3}
                                value={edit.gemini_prompt}
                                onChange={(e) => setActionEdits((prev) => ({ ...prev, [a.id]: { ...edit, gemini_prompt: e.target.value } }))}
                                placeholder="Instrucción para Gemini (vacío = predeterminado)&#10;Ej: Comentá el video con tono crítico, en español, máx 1 oración."
                                className="w-full bg-hate-gray border border-gray-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-hate-red resize-none placeholder-gray-600"
                              />
                            </div>

                            <button
                              onClick={() => handleActionSave(selectedBot.id, a.id)}
                              className="w-full text-xs bg-hate-red/20 hover:bg-hate-red/40 text-hate-red py-1.5 rounded-lg font-bold transition"
                            >
                              Guardar cambios
                            </button>

                            {/* Historial de ejecuciones */}
                            {a.run_log?.length > 0 && (
                              <div className="border-t border-gray-700/50 pt-2 space-y-1">
                                <p className="text-xs text-gray-600 font-semibold">Historial</p>
                                <div className="max-h-28 overflow-y-auto space-y-0.5">
                                  {[...a.run_log].reverse().map((ts: string, i: number) => (
                                    <p key={i} className="text-gray-600 text-xs font-mono">
                                      {new Date(ts).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                  </div>
                </div>
              )}

            </div>
          )}

          {/* ── Mis Perfiles ── */}
          {section === "perfiles" && (
            <div>
              <div className="mb-6">
                <h1 className="text-2xl font-black text-white">Mis Perfiles</h1>
                <p className="text-gray-500 text-sm mt-1">
                  Entrá directamente a cualquier cuenta. Para volver al admin, usá ← en el feed.
                </p>
              </div>

              {loading ? (
                <p className="text-gray-500 text-sm">Cargando...</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className={`bg-hate-gray rounded-2xl border border-gray-800 p-4 flex flex-col items-center gap-3 text-center ${!u.is_active ? "opacity-40" : ""}`}
                    >
                      {/* Avatar */}
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-hate-light flex items-center justify-center flex-shrink-0">
                        {u.avatar_url
                          ? <img src={u.avatar_url} alt={u.display_name} className="w-full h-full object-cover" />
                          : <span className="text-hate-red text-2xl font-black">{u.display_name[0]}</span>
                        }
                      </div>

                      {/* Nombre y badges */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm truncate">{u.display_name}</p>
                        <p className="text-gray-500 text-xs truncate">@{u.username}</p>
                        <div className="flex flex-wrap justify-center gap-1 mt-1.5">
                          {u.is_admin && (
                            <span className="text-xs bg-hate-red/20 text-hate-red px-1.5 py-0.5 rounded-full">Admin</span>
                          )}
                          {u.is_fictitious && (
                            <span className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded-full">Bot</span>
                          )}
                        </div>
                      </div>

                      {/* Botones */}
                      <div className="flex gap-1.5 w-full">
                        <button
                          onClick={() => handleImpersonate(u.id)}
                          disabled={!u.is_active}
                          className="flex-1 text-xs bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 font-bold py-1.5 rounded-xl transition disabled:opacity-30"
                        >
                          Entrar
                        </button>
                        <a
                          href={`/profile/${u.username}`}
                          target="_blank"
                          className="flex-1 text-xs bg-hate-light hover:bg-gray-700 text-gray-400 hover:text-white font-bold py-1.5 rounded-xl transition text-center"
                        >
                          Ver
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
