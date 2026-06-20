"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { postApi, communityApi, storyApi, StoryGroup } from "@/lib/api";
import PostCard from "@/components/PostCard";
import FAB from "@/components/FAB";
import NotificationBell from "@/components/NotificationBell";
import { useLanguage } from "@/hooks/useLanguage";

type Section = "main" | "onlys" | "gay" | "lesbiana" | "hetero" | "historys";

const COMMUNITY_BUTTONS: { key: Section; label: string; bg: string }[] = [
  { key: "onlys",    label: "Onlys",  bg: "/bg/onlys.png" },
  { key: "gay",      label: "GZone",  bg: "/bg/gzone.jpg" },
  { key: "lesbiana", label: "LZone",  bg: "/bg/lzone.jpg" },
  { key: "hetero",   label: "HZone",  bg: "/bg/hzone.jpg" },
];

const ORIENTATION_SLUGS: Partial<Record<Section, string>> = {
  gay: "gay", lesbiana: "lesbiana", hetero: "hetero",
};

export default function FeedPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [section, setSection] = useState<Section | null>(null);
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [community, setCommunity] = useState<any>(null);
  const [communityPosts, setCommunityPosts] = useState<any[]>([]);
  const [joining, setJoining] = useState(false);
  const [fanGroups, setFanGroups] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  // Community feed controls
  const [communityFilter, setCommunityFilter] = useState<"new" | "top" | "own" | "tagged">("new");
  const [showCommunityMenu, setShowCommunityMenu] = useState(false);

  // Stories
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [activeGroup, setActiveGroup] = useState<StoryGroup | null>(null);
  const [activeStoryIdx, setActiveStoryIdx] = useState(0);

  const [isPreviousSession, setIsPreviousSession] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.replace("/login"); return; }
    const u = localStorage.getItem("user");
    if (u) setUser(JSON.parse(u));
  }, [router]);

  useEffect(() => {
    setIsPreviousSession(!!localStorage.getItem("_prev_token"));
  }, []);

  useEffect(() => {
    if (section === "main") {
      postApi.feed().then(setPosts).catch(console.error);
    } else if (section === "onlys") {
      communityApi.list("fan", search || undefined).then(setFanGroups).catch(console.error);
    } else if (section === "historys") {
      storyApi.feed().then(setStoryGroups).catch(console.error);
    } else if (section && ORIENTATION_SLUGS[section]) {
      const slug = ORIENTATION_SLUGS[section]!;
      setCommunityFilter("new");
      setShowCommunityMenu(false);
      communityApi.get(slug).then(setCommunity).catch(console.error);
      communityApi.feed(slug, "new", "all").then(setCommunityPosts).catch(console.error);
    }
  }, [section]);

  useEffect(() => {
    if (section && ORIENTATION_SLUGS[section]) {
      const slug = ORIENTATION_SLUGS[section]!;
      const sort = communityFilter === "top" ? "top" : "new";
      const view = communityFilter === "own" ? "own" : communityFilter === "tagged" ? "tagged" : "all";
      communityApi.feed(slug, sort, view).then(setCommunityPosts).catch(console.error);
    }
  }, [communityFilter]);

  useEffect(() => {
    if (section === "onlys") {
      communityApi.list("fan", search || undefined).then(setFanGroups).catch(console.error);
    }
  }, [search]);

  // Reset viewer al cambiar de grupo
  function selectGroup(group: StoryGroup) {
    setActiveGroup(group);
    setActiveStoryIdx(0);
  }

  async function handleJoin() {
    if (!community || !section) return;
    const slug = ORIENTATION_SLUGS[section]!;
    setJoining(true);
    try {
      await communityApi.join(slug);
      setCommunity((c: any) => ({ ...c, is_member: true, member_count: c.member_count + 1 }));
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave() {
    if (!community || !section) return;
    const slug = ORIENTATION_SLUGS[section]!;
    setShowCommunityMenu(false);
    try {
      await communityApi.leave(slug);
      setCommunity((c: any) => ({ ...c, is_member: false, member_count: c.member_count - 1 }));
    } catch {}
  }

  function restorePrevSession() {
    const prevToken = localStorage.getItem("_prev_token");
    const prevUser  = localStorage.getItem("_prev_user");
    localStorage.setItem("token", prevToken || "");
    localStorage.setItem("user", prevUser || "");
    localStorage.removeItem("_prev_token");
    localStorage.removeItem("_prev_user");
    window.location.href = "/admin";
  }

  function logout() {
    localStorage.clear();
    router.push("/login");
  }

  const currentStory = activeGroup?.stories[activeStoryIdx];

  return (
    <div className="h-screen bg-hate-dark flex flex-col items-center overflow-hidden">

      {/* Banner de impersonación */}
      {isPreviousSession && (
        <div className="w-full bg-blue-600 text-white text-xs flex items-center justify-between px-4 py-1.5 flex-shrink-0">
          <span>Estás navegando como <strong>@{user?.username}</strong></span>
          <button onClick={restorePrevSession} className="underline font-bold hover:text-blue-200 transition">
            ← Volver a mi cuenta
          </button>
        </div>
      )}

      {/* Navbar */}
      <nav className="w-full max-w-[430px] bg-hate-gray border-b border-gray-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <span className="text-2xl font-black text-hate-red">HateGram</span>
        <div className="flex items-center gap-3">
          {user && (
            <Link href={`/profile/${user.username}`} className="text-gray-300 hover:text-white text-sm">
              @{user.username}
            </Link>
          )}
          <Link href="/messages" className="text-gray-400 hover:text-white transition text-xl leading-none">✉️</Link>
          <NotificationBell />
          {user?.is_admin && (
            <Link href="/admin" className="bg-hate-red/20 hover:bg-hate-red/40 text-hate-red text-xs font-bold px-3 py-1.5 rounded-full transition">
              ⚙️ Admin
            </Link>
          )}
          <button onClick={logout} className="text-gray-500 hover:text-hate-red text-sm transition">{t("logout")}</button>
        </div>
      </nav>

      {/* Main Feed + Historys */}
      <div className="w-full max-w-[430px] px-3 pt-3 flex-shrink-0 flex gap-2">
        <button
          onClick={() => setSection(section === "main" ? null : "main")}
          className={`flex-1 py-3 rounded-2xl font-black text-sm tracking-widest uppercase transition border-2 ${
            section === "main"
              ? "bg-hate-red border-hate-red text-white"
              : "bg-hate-gray border-gray-700 text-gray-300 hover:border-hate-red hover:text-white"
          }`}
        >
          Main Feed
        </button>
        <button
          onClick={() => {
            const next = section === "historys" ? null : "historys";
            setSection(next);
            if (next !== "historys") setActiveGroup(null);
          }}
          className={`flex-1 py-3 rounded-2xl font-black text-sm tracking-widest uppercase transition border-2 ${
            section === "historys"
              ? "bg-hate-red border-hate-red text-white"
              : "bg-hate-gray border-gray-700 text-gray-300 hover:border-hate-red hover:text-white"
          }`}
        >
          Historys
        </button>
      </div>

      {/* Círculos: comunidades o stories */}
      <div className="w-full max-w-[430px] px-3 pt-3 flex-shrink-0">
        {section === "historys" ? (
          /* ── Story circles ── */
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {storyGroups.length === 0 ? (
              <p className="text-gray-600 text-xs py-3">No hay stories de personas que seguís</p>
            ) : (
              storyGroups.map((group) => (
                <button
                  key={group.user_id}
                  onClick={() => selectGroup(group)}
                  className="flex flex-col items-center gap-1 flex-shrink-0"
                >
                  <div
                    className={`w-14 h-14 rounded-full border-2 overflow-hidden transition ${
                      activeGroup?.user_id === group.user_id
                        ? "border-hate-red"
                        : "border-gray-600 hover:border-gray-400"
                    }`}
                  >
                    {group.avatar_url ? (
                      <img src={group.avatar_url} alt={group.username} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-hate-gray flex items-center justify-center text-gray-400 text-lg font-bold">
                        {group.username[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 truncate w-14 text-center">{group.username}</span>
                </button>
              ))
            )}
          </div>
        ) : (
          /* ── Community buttons ── */
          <div className="grid grid-cols-4 gap-2">
            {COMMUNITY_BUTTONS.map(({ key, label, bg }) => (
              <button
                key={key}
                onClick={() => setSection(section === key ? null : key)}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div
                  className="relative w-full aspect-square rounded-full overflow-hidden flex items-center justify-center border-2 transition"
                  style={{
                    borderColor: section === key ? "#E63946" : "transparent",
                    ...(bg ? { backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
                  }}
                >
                  {!bg && (
                    <div className={`absolute inset-0 transition ${section === key ? "bg-hate-red" : "bg-hate-gray group-hover:bg-hate-light"}`} />
                  )}
                  {bg && <div className="absolute inset-0 bg-black/30" />}
                  <span className="relative z-10 text-white font-black text-xs tracking-wider drop-shadow-lg">
                    {label}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Área de contenido — scrolleable */}
      <div className="w-full max-w-[430px] flex-1 overflow-y-auto mt-2">

        {/* Nada seleccionado */}
        {!section && (
          <div className="flex flex-col items-center justify-center h-full text-gray-700 gap-2">
            <p className="text-3xl">👆</p>
            <p className="text-sm">Seleccioná un feed para comenzar</p>
          </div>
        )}

        {/* ── Main Feed ── */}
        {section === "main" && (
          <div>
            {posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-700">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-sm">Sin posts aún</p>
              </div>
            ) : (
              posts.map((post) => <PostCard key={post.id} post={post} currentUserId={user?.id} />)
            )}
          </div>
        )}

        {/* ── Historys viewer ── */}
        {section === "historys" && (
          <div className="flex flex-col h-full">
            {!activeGroup || !currentStory ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-700 gap-2">
                <p className="text-3xl">👆</p>
                <p className="text-sm">Seleccioná una story para verla</p>
              </div>
            ) : (
              <>
                {/* Media */}
                <div className="flex-1 flex items-center justify-center bg-black min-h-0">
                  {currentStory.media_type === "video" ? (
                    <video
                      key={currentStory.id}
                      src={currentStory.media_url}
                      autoPlay
                      controls
                      className="max-h-full max-w-full"
                    />
                  ) : (
                    <img
                      src={currentStory.media_url}
                      alt=""
                      className="max-h-full max-w-full object-contain"
                    />
                  )}
                </div>

                {/* Info + navegación */}
                <div className="bg-hate-gray border-t border-gray-800 flex-shrink-0">
                  <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                    <Link href={`/profile/${activeGroup.username}`} className="font-bold text-white text-sm hover:text-hate-red transition">
                      @{activeGroup.username}
                    </Link>
                    {activeGroup.stories.length > 1 && (
                      <span className="text-gray-500 text-xs">
                        {activeStoryIdx + 1} / {activeGroup.stories.length}
                      </span>
                    )}
                  </div>

                  {currentStory.caption && (
                    <p className="px-4 pb-2 text-gray-300 text-sm">{currentStory.caption}</p>
                  )}

                  {activeGroup.stories.length > 1 && (
                    <div className="flex gap-2 px-4 pb-3">
                      <button
                        onClick={() => setActiveStoryIdx((i) => Math.max(0, i - 1))}
                        disabled={activeStoryIdx === 0}
                        className="flex-1 py-1.5 rounded-xl border border-gray-700 text-gray-400 text-sm disabled:opacity-25 hover:border-gray-500 transition"
                      >
                        ←
                      </button>
                      <button
                        onClick={() => setActiveStoryIdx((i) => Math.min(activeGroup.stories.length - 1, i + 1))}
                        disabled={activeStoryIdx === activeGroup.stories.length - 1}
                        className="flex-1 py-1.5 rounded-xl border border-gray-700 text-gray-400 text-sm disabled:opacity-25 hover:border-gray-500 transition"
                      >
                        →
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Onlys ── */}
        {section === "onlys" && (
          <div className="px-3 pb-4">
            <div className="flex gap-2 py-3">
              <input
                type="text"
                placeholder="Buscar grupos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-hate-gray border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-hate-red"
              />
              {user?.is_verified && (
                <Link href="/communities/create"
                  className="bg-hate-red hover:bg-red-700 text-white text-sm font-bold px-4 rounded-xl transition flex items-center">
                  + Crear
                </Link>
              )}
            </div>
            {fanGroups.length === 0 ? (
              <div className="text-center py-10 text-gray-600">
                <p className="text-3xl mb-2">⭐</p>
                <p className="text-sm">No hay grupos fan todavía</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {fanGroups.map((c) => (
                  <Link key={c.slug} href={`/communities/${c.slug}`}
                    className="relative rounded-2xl overflow-hidden aspect-[3/4] group">
                    <div className="absolute inset-0 bg-hate-gray group-hover:bg-hate-light transition" />
                    {c.image_url && <img src={c.image_url} alt={c.name} className="absolute inset-0 w-full h-full object-cover" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                    <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-hate-red transition" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white font-black text-sm">{c.name}</p>
                      <p className="text-gray-400 text-xs">{c.member_count} miembros</p>
                      {c.is_member && <span className="text-xs text-hate-red font-bold">● Miembro</span>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Comunidades de orientación ── */}
        {section && ORIENTATION_SLUGS[section] && (
          <div>
            {community && (
              community.is_member ? (
                /* ── Miembro: filtros + menú ── */
                <div className="mx-3 my-3 space-y-2">
                  <div className="flex items-center gap-2">
                    {/* Filter tabs */}
                    <div className="flex flex-1 bg-hate-gray rounded-xl border border-gray-800 overflow-hidden">
                      {([
                        { key: "new",    label: t("filter_new")    },
                        { key: "top",    label: t("filter_top")    },
                        { key: "own",    label: t("filter_own")    },
                        { key: "tagged", label: t("filter_tagged") },
                      ] as const).map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => setCommunityFilter(key)}
                          className={`flex-1 py-2 text-xs font-bold transition ${
                            communityFilter === key
                              ? "bg-hate-red text-white"
                              : "text-gray-500 hover:text-gray-300"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Menu button */}
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={() => setShowCommunityMenu((v) => !v)}
                        className="w-10 h-10 bg-hate-gray border border-gray-700 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-500 transition text-lg font-bold"
                      >
                        ⋮
                      </button>
                      {showCommunityMenu && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setShowCommunityMenu(false)} />
                          <div className="absolute right-0 top-12 bg-hate-gray border border-gray-700 rounded-xl shadow-xl z-20 w-44 overflow-hidden">
                            <button
                              onClick={() => { setShowCommunityMenu(false); router.push("/communities/create"); }}
                              className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-hate-light transition"
                            >
                              {t("community_create_group")}
                            </button>
                            <button
                              onClick={() => setShowCommunityMenu(false)}
                              className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-hate-light transition border-t border-gray-800"
                            >
                              {t("community_search")}
                            </button>
                            <button
                              onClick={handleLeave}
                              className="w-full text-left px-4 py-3 text-sm text-hate-red hover:bg-hate-light transition border-t border-gray-800"
                            >
                              {t("community_leave")}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* ── No miembro: Unirse ── */
                <div className="mx-3 my-3 bg-hate-gray rounded-2xl px-4 py-3 flex items-center gap-3 border border-gray-800">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm">{community.name}</p>
                    <p className="text-gray-500 text-xs">{community.member_count} miembros</p>
                  </div>
                  <button
                    onClick={handleJoin}
                    disabled={joining}
                    className="text-xs font-bold px-4 py-2 rounded-xl bg-hate-red hover:bg-red-700 text-white transition disabled:opacity-50 flex-shrink-0"
                  >
                    {joining ? "..." : t("community_join")}
                  </button>
                </div>
              )
            )}

            {communityPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-700">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-sm text-center px-4">
                  {community?.is_member ? "Sin posts aún. ¡Publicá algo!" : "Unite para ver y publicar en esta comunidad."}
                </p>
              </div>
            ) : (
              communityPosts.map((post) => <PostCard key={post.id} post={post} currentUserId={user?.id} />)
            )}
          </div>
        )}

      </div>

      <FAB onPostCreated={() => {
        if (section === "main") postApi.feed().then(setPosts).catch(() => {});
      }} />


    </div>
  );
}
