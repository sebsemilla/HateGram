import { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, FlatList, TouchableOpacity,
  Image, StyleSheet, Alert, ActivityIndicator, Animated, TextInput, Share,
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { postApi, communityApi, storyApi, reactionsApi, commentsApi, reportApi, auth, StoryGroup, ReactionsOut, CommentOut } from "../lib/api";
import NotificationBell from "../components/NotificationBell";

type Section = "main" | "onlys" | "gay" | "lesbiana" | "hetero" | "historys" | null;

const COMMUNITY_CIRCLES = [
  { key: "onlys",    label: "Onlys",  color: "#3D0000" },
  { key: "gay",      label: "GZone",  color: "#001A3D" },
  { key: "lesbiana", label: "LZone",  color: "#1A003D" },
  { key: "hetero",   label: "HZone",  color: "#1A1A00" },
] as const;

const ORIENTATION_SLUGS: Partial<Record<string, string>> = {
  gay: "gay", lesbiana: "lesbiana", hetero: "hetero",
};

export default function FeedScreen() {
  const router = useRouter();
  const [user, setUser]                   = useState<any>(null);
  const [verifyBannerDismissed, setVerifyBannerDismissed] = useState(false);
  const [verifyResent, setVerifyResent]   = useState(false);
  const [section, setSection]             = useState<Section>(null);
  const [posts, setPosts]                 = useState<any[]>([]);
  const [fanGroups, setFanGroups]         = useState<any[]>([]);
  const [community, setCommunity]         = useState<any>(null);
  const [communityPosts, setCommunityPosts] = useState<any[]>([]);
  const [joining, setJoining]             = useState(false);
  const [loading, setLoading]             = useState(false);
  const [communityFilter, setCommunityFilter] = useState<"new"|"top"|"own"|"tagged">("new");
  const [showCommunityMenu, setShowCommunityMenu] = useState(false);

  // Stories
  const [storyGroups, setStoryGroups]     = useState<StoryGroup[]>([]);
  const [activeGroup, setActiveGroup]     = useState<StoryGroup | null>(null);
  const [activeStoryIdx, setActiveStoryIdx] = useState(0);

  // FAB
  const [fabOpen, setFabOpen]             = useState(false);
  const fabAnim                           = useRef(new Animated.Value(0)).current;

  // ── Auth ──────────────────────────────────────────────────────
  useEffect(() => {
    SecureStore.getItemAsync("token").then((t) => {
      if (!t) { router.replace("/login"); return; }
    });
    SecureStore.getItemAsync("user").then((u) => {
      if (u) setUser(JSON.parse(u));
    });
  }, []);

  // ── Load content by section ───────────────────────────────────
  useEffect(() => {
    if (!section) return;
    setLoading(true);
    if (section === "main") {
      postApi.feed().then(setPosts).catch(console.error).finally(() => setLoading(false));
    } else if (section === "historys") {
      storyApi.feed().then(setStoryGroups).catch(console.error).finally(() => setLoading(false));
    } else if (section === "onlys") {
      communityApi.list("fan").then(setFanGroups).catch(console.error).finally(() => setLoading(false));
    } else if (ORIENTATION_SLUGS[section]) {
      const slug = ORIENTATION_SLUGS[section]!;
      setCommunityFilter("new");
      setShowCommunityMenu(false);
      Promise.all([
        communityApi.get(slug).then(setCommunity),
        communityApi.feed(slug, "new", "all").then(setCommunityPosts),
      ]).catch(console.error).finally(() => setLoading(false));
    }
  }, [section]);

  useEffect(() => {
    if (!section || !ORIENTATION_SLUGS[section]) return;
    const slug = ORIENTATION_SLUGS[section]!;
    const sort = communityFilter === "top" ? "top" : "new";
    const view = communityFilter === "own" ? "own" : communityFilter === "tagged" ? "tagged" : "all";
    communityApi.feed(slug, sort, view).then(setCommunityPosts).catch(console.error);
  }, [communityFilter]);

  // ── FAB animation ─────────────────────────────────────────────
  useEffect(() => {
    Animated.spring(fabAnim, {
      toValue: fabOpen ? 1 : 0,
      useNativeDriver: true,
      friction: 6,
    }).start();
  }, [fabOpen]);

  // ── Handlers ──────────────────────────────────────────────────
  function toggleSection(key: Section) {
    setSection((prev) => {
      if (prev === key) { return null; }
      if (key !== "historys") setActiveGroup(null);
      return key;
    });
  }

  function selectStoryGroup(group: StoryGroup) {
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
    } catch (e: any) {
      Alert.alert("Error", e.message);
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
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  }

  async function logout() {
    await SecureStore.deleteItemAsync("token");
    await SecureStore.deleteItemAsync("user");
    router.replace("/login");
  }

  // ── FAB sub-button positions ──────────────────────────────────
  const FAB_ITEMS = [
    { label: "Post",        onPress: () => {} },
    { label: "Add\nHistory", onPress: () => { setFabOpen(false); router.push("/stories/create"); } },
    { label: "Live\nRec",   onPress: () => {} },
  ];

  const currentStory = activeGroup?.stories[activeStoryIdx];

  // ──────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.logo}>feedpod</Text>
        <View style={s.headerRight}>
          {user && (
            <TouchableOpacity onPress={() => router.push(`/profile/${user.username}`)}>
              <Text style={s.headerUser}>@{user.username}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.push("/search" as any)}>
            <Text style={s.headerIcon}>🔍</Text>
          </TouchableOpacity>
          <NotificationBell />
          <TouchableOpacity onPress={logout}>
            <Text style={s.logoutBtn}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Banner verificación de email */}
      {user && !user.is_verified && !verifyBannerDismissed && (
        <View style={s.verifyBanner}>
          <Text style={s.verifyIcon}>⚠️</Text>
          <View style={{ flex: 1 }}>
            {verifyResent ? (
              <Text style={s.verifyText}>Email reenviado. Revisá tu bandeja.</Text>
            ) : (
              <>
                <Text style={s.verifyTitle}>Verificá tu email</Text>
                <TouchableOpacity onPress={async () => { await auth.resendVerification(); setVerifyResent(true); }}>
                  <Text style={s.verifyLink}>Reenviar email de verificación</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          <TouchableOpacity onPress={() => setVerifyBannerDismissed(true)}>
            <Text style={s.verifyClose}>×</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Feed / Historys buttons */}
      <View style={s.tabRow}>
        <TouchableOpacity
          style={[s.tabBtn, section === "main" && s.tabBtnActive]}
          onPress={() => toggleSection("main")}
        >
          <Text style={[s.tabBtnText, section === "main" && s.tabBtnTextActive]}>
            Main Feed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tabBtn, section === "historys" && s.tabBtnActive]}
          onPress={() => toggleSection("historys")}
        >
          <Text style={[s.tabBtnText, section === "historys" && s.tabBtnTextActive]}>
            Historys
          </Text>
        </TouchableOpacity>
      </View>

      {/* Circles row: communities OR stories */}
      <View style={s.circlesContainer}>
        {section === "historys" ? (
          /* ── Story circles ── */
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.circlesScroll}>
            {storyGroups.length === 0 ? (
              <Text style={s.emptyCircles}>No hay stories de personas que seguís</Text>
            ) : (
              storyGroups.map((group) => (
                <TouchableOpacity key={group.user_id} style={s.storyCircleWrap} onPress={() => selectStoryGroup(group)}>
                  <View style={[s.storyCircle, activeGroup?.user_id === group.user_id && s.storyCircleActive]}>
                    {group.avatar_url ? (
                      <Image source={{ uri: group.avatar_url }} style={s.storyCircleImg} />
                    ) : (
                      <Text style={s.storyCircleLetter}>{group.username[0].toUpperCase()}</Text>
                    )}
                  </View>
                  <Text style={s.storyCircleLabel} numberOfLines={1}>{group.username}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        ) : (
          /* ── Community circles ── */
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.circlesScroll}>
            {COMMUNITY_CIRCLES.map(({ key, label, color }) => (
              <TouchableOpacity key={key} style={s.communityCircleWrap} onPress={() => toggleSection(key as Section)}>
                <View style={[
                  s.communityCircle,
                  { backgroundColor: color },
                  section === key && s.communityCircleActive,
                ]}>
                  <Text style={s.communityCircleLabel}>{label}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Content area */}
      <View style={s.content}>
        {loading && <ActivityIndicator color="#E63946" style={{ marginTop: 40 }} />}

        {/* Nothing selected */}
        {!section && !loading && (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>👆</Text>
            <Text style={s.emptyText}>Seleccioná un feed para comenzar</Text>
          </View>
        )}

        {/* ── Main Feed ── */}
        {section === "main" && !loading && (
          <FlatList
            data={posts}
            keyExtractor={(p) => String(p.id)}
            contentContainerStyle={{ paddingBottom: 120 }}
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyIcon}>📭</Text>
                <Text style={s.emptyText}>Sin posts aún</Text>
              </View>
            }
            renderItem={({ item }) => <PostCard post={item} currentUserId={user?.id} />}
          />
        )}

        {/* ── Historys viewer ── */}
        {section === "historys" && !loading && (
          <View style={{ flex: 1 }}>
            {!activeGroup || !currentStory ? (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>👆</Text>
                <Text style={s.emptyText}>Seleccioná una story para verla</Text>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                {/* Media */}
                <View style={s.storyMedia}>
                  {currentStory.media_type === "video" ? (
                    <View style={s.videoPlaceholder}>
                      <Text style={s.videoPlaceholderText}>▶ Video</Text>
                      <Text style={s.videoPlaceholderSub}>Requiere expo-av</Text>
                    </View>
                  ) : (
                    <Image
                      source={{ uri: currentStory.media_url }}
                      style={s.storyImage}
                      resizeMode="contain"
                    />
                  )}
                  {/* Hashtag overlay */}
                  {currentStory.hashtag ? (
                    <View style={s.hashtagOverlay}>
                      <Text style={s.hashtagText}>#{currentStory.hashtag}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Info + nav */}
                <View style={s.storyInfo}>
                  <View style={s.storyInfoRow}>
                    <TouchableOpacity onPress={() => router.push(`/profile/${activeGroup.username}`)}>
                      <Text style={s.storyUsername}>@{activeGroup.username}</Text>
                    </TouchableOpacity>
                    {activeGroup.stories.length > 1 && (
                      <Text style={s.storyCounter}>
                        {activeStoryIdx + 1} / {activeGroup.stories.length}
                      </Text>
                    )}
                  </View>
                  {currentStory.caption ? (
                    <Text style={s.storyCaption}>{currentStory.caption}</Text>
                  ) : null}
                  {activeGroup.stories.length > 1 && (
                    <View style={s.storyNavRow}>
                      <TouchableOpacity
                        style={[s.storyNavBtn, activeStoryIdx === 0 && s.storyNavBtnDisabled]}
                        disabled={activeStoryIdx === 0}
                        onPress={() => setActiveStoryIdx((i) => Math.max(0, i - 1))}
                      >
                        <Text style={s.storyNavBtnText}>←</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.storyNavBtn, activeStoryIdx === activeGroup.stories.length - 1 && s.storyNavBtnDisabled]}
                        disabled={activeStoryIdx === activeGroup.stories.length - 1}
                        onPress={() => setActiveStoryIdx((i) => Math.min(activeGroup.stories.length - 1, i + 1))}
                      >
                        <Text style={s.storyNavBtnText}>→</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Onlys ── */}
        {section === "onlys" && !loading && (
          <FlatList
            data={fanGroups}
            keyExtractor={(c) => c.slug}
            numColumns={2}
            contentContainerStyle={{ padding: 8, paddingBottom: 120 }}
            columnWrapperStyle={{ gap: 8 }}
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyIcon}>⭐</Text>
                <Text style={s.emptyText}>No hay grupos fan todavía</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.fanCard}
                onPress={() => router.push(`/communities/${item.slug}`)}
              >
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : null}
                <View style={s.fanCardOverlay} />
                <View style={s.fanCardInfo}>
                  <Text style={s.fanCardName}>{item.name}</Text>
                  <Text style={s.fanCardMembers}>{item.member_count} miembros</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}

        {/* ── Orientation communities ── */}
        {section && ORIENTATION_SLUGS[section] && !loading && (
          <View style={{ flex: 1 }}>
            {community && (
              community.is_member ? (
                /* ── Miembro: filtros + menú ── */
                <View style={s.communityBar}>
                  <View style={s.filterRow}>
                    {(["new","top","own","tagged"] as const).map((f) => (
                      <TouchableOpacity
                        key={f}
                        onPress={() => setCommunityFilter(f)}
                        style={[s.filterBtn, communityFilter === f && s.filterBtnActive]}
                      >
                        <Text style={[s.filterBtnText, communityFilter === f && s.filterBtnTextActive]}>
                          {f === "new" ? "New" : f === "top" ? "Top" : f === "own" ? "Propios" : "Tagged"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={{ position: "relative" }}>
                    <TouchableOpacity
                      style={s.menuBtn}
                      onPress={() => setShowCommunityMenu((v) => !v)}
                    >
                      <Text style={s.menuBtnText}>⋮</Text>
                    </TouchableOpacity>
                    {showCommunityMenu && (
                      <View style={s.menuDropdown}>
                        <TouchableOpacity
                          style={s.menuItem}
                          onPress={() => { setShowCommunityMenu(false); router.push("/communities/create" as any); }}
                        >
                          <Text style={s.menuItemText}>Crear Grupo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.menuItem, s.menuItemBorder]} onPress={() => setShowCommunityMenu(false)}>
                          <Text style={s.menuItemText}>Buscar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.menuItem, s.menuItemBorder]} onPress={handleLeave}>
                          <Text style={[s.menuItemText, s.menuItemDanger]}>Salir</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              ) : (
                /* ── No miembro: Unirse ── */
                <View style={s.communityBar}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.communityName}>{community.name}</Text>
                    <Text style={s.communityMembers}>{community.member_count} miembros</Text>
                  </View>
                  <TouchableOpacity style={s.joinBtn} onPress={handleJoin} disabled={joining}>
                    <Text style={s.joinBtnText}>{joining ? "..." : "Unirse"}</Text>
                  </TouchableOpacity>
                </View>
              )
            )}
            <FlatList
              data={communityPosts}
              keyExtractor={(p) => String(p.id)}
              contentContainerStyle={{ paddingBottom: 120 }}
              ListEmptyComponent={
                <View style={s.empty}>
                  <Text style={s.emptyIcon}>📭</Text>
                  <Text style={s.emptyText}>
                    {community?.is_member ? "Sin posts aún." : "Unite para ver el contenido."}
                  </Text>
                </View>
              }
              renderItem={({ item }) => <PostCard post={item} currentUserId={user?.id} />}
            />
          </View>
        )}
      </View>

      {/* FAB */}
      <View style={s.fabContainer} pointerEvents="box-none">
        {/* Sub-buttons */}
        {FAB_ITEMS.map((item, i) => {
          const translateY = fabAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -(i + 1) * 68],
          });
          const opacity = fabAnim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, 0, 1],
          });
          return (
            <Animated.View
              key={item.label}
              style={[s.fabSub, { transform: [{ translateY }], opacity }]}
              pointerEvents={fabOpen ? "auto" : "none"}
            >
              <TouchableOpacity style={s.fabSubBtn} onPress={item.onPress}>
                <Text style={s.fabSubLabel}>{item.label}</Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {/* Main button */}
        <TouchableOpacity style={s.fabMain} onPress={() => setFabOpen((v) => !v)}>
          <Animated.Text style={[s.fabIcon, {
            transform: [{ rotate: fabAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] }) }],
          }]}>
            +
          </Animated.Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

// ── Reaction config ───────────────────────────────────────────────
const REACTIONS = [
  { key: "heart",  emoji: "❤️" },
  { key: "fire",   emoji: "🔥" },
  { key: "cringe", emoji: "😬" },
  { key: "cope",   emoji: "😤" },
  { key: "based",  emoji: "👊" },
  { key: "dead",   emoji: "💀" },
] as const;

// ── PostCard ──────────────────────────────────────────────────────
const REPORT_REASONS = [
  { key: "spam",                  label: "Spam" },
  { key: "acoso",                 label: "Acoso" },
  { key: "contenido_inapropiado", label: "Contenido inapropiado" },
  { key: "discurso_de_odio",      label: "Discurso de odio" },
  { key: "desinformacion",        label: "Desinformación" },
  { key: "violencia",             label: "Violencia" },
  { key: "otro",                  label: "Otro" },
];

function PostCard({ post, currentUserId }: { post: any; currentUserId?: number }) {
  const [reactions, setReactions] = useState<ReactionsOut | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentOut[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentSort, setCommentSort] = useState<"top" | "new">("top");
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: number; username: string } | null>(null);

  useEffect(() => {
    reactionsApi.get(post.id).then(setReactions).catch(() => {});
  }, [post.id]);

  useEffect(() => {
    if (showComments && !commentsLoaded) {
      commentsApi.get(post.id, commentSort).then((data) => {
        setComments(data);
        setCommentsLoaded(true);
      }).catch(() => {});
    }
  }, [showComments]);

  useEffect(() => {
    if (commentsLoaded) {
      commentsApi.get(post.id, commentSort).then(setComments).catch(() => {});
    }
  }, [commentSort]);

  async function handleReaction(type: string) {
    try { setReactions(await reactionsApi.toggle(post.id, type)); } catch {}
  }

  async function handleVote(commentId: number, vote: 1 | -1) {
    try {
      const updated = await commentsApi.vote(commentId, vote);
      setComments((prev) => replaceComment(prev, updated));
    } catch {}
  }

  async function handleDeleteComment(commentId: number) {
    try {
      await commentsApi.delete(commentId);
      setComments((prev) => removeComment(prev, commentId));
    } catch {}
  }

  async function handleSubmitComment() {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const created = await commentsApi.create(post.id, newComment.trim(), replyTo?.id);
      if (replyTo) {
        setComments((prev) => addReply(prev, replyTo.id, created));
      } else {
        setComments((prev) => [created, ...prev]);
      }
      setNewComment("");
      setReplyTo(null);
    } catch {} finally { setSubmitting(false); }
  }

  function replaceComment(list: CommentOut[], updated: CommentOut): CommentOut[] {
    return list.map((c) =>
      c.id === updated.id ? { ...updated, replies: c.replies }
        : { ...c, replies: replaceComment(c.replies, updated) }
    );
  }
  function removeComment(list: CommentOut[], id: number): CommentOut[] {
    return list.filter((c) => c.id !== id).map((c) => ({ ...c, replies: removeComment(c.replies, id) }));
  }
  function addReply(list: CommentOut[], parentId: number, reply: CommentOut): CommentOut[] {
    return list.map((c) =>
      c.id === parentId ? { ...c, replies: [...c.replies, reply] }
        : { ...c, replies: addReply(c.replies, parentId, reply) }
    );
  }

  const totalComments = comments.reduce(function count(acc: number, c: CommentOut): number {
    return acc + 1 + c.replies.reduce(count, 0);
  }, 0);

  function handleReport() {
    Alert.alert(
      "Reportar post",
      "¿Cuál es el motivo?",
      [
        ...REPORT_REASONS.map(({ key, label }) => ({
          text: label,
          onPress: () => {
            reportApi.create({ reason: key, reported_post_id: post.id })
              .then(() => Alert.alert("✓ Reporte enviado", "Gracias por ayudarnos a mantener la comunidad."))
              .catch(() => Alert.alert("Error", "No se pudo enviar el reporte."));
          },
        })),
        { text: "Cancelar", style: "cancel" as const },
      ]
    );
  }

  return (
    <View style={s.postCard}>
      {/* Header */}
      <View style={s.postHeader}>
        <View style={s.postAvatar}>
          {post.avatar_url ? (
            <Image source={{ uri: post.avatar_url }} style={s.postAvatarImg} />
          ) : (
            <Text style={s.postAvatarLetter}>{(post.display_name || post.username)[0]}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.postDisplayName}>{post.display_name || post.username}</Text>
          <Text style={s.postUsername}>@{post.username}</Text>
        </View>
        <TouchableOpacity onPress={handleReport} style={s.reportBtn}>
          <Text style={s.reportBtnText}>🚩</Text>
        </TouchableOpacity>
      </View>

      {/* Image */}
      {post.image_url ? (
        <Image source={{ uri: post.image_url }} style={s.postImage} resizeMode="cover" />
      ) : null}

      {/* Caption */}
      {post.caption ? <Text style={s.postCaption}>{post.caption}</Text> : null}

      {/* Reaction bar */}
      <View style={s.reactionsRow}>
        {REACTIONS.map(({ key, emoji }) => {
          const count = reactions?.counts?.[key] ?? 0;
          const active = reactions?.my_reaction === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => handleReaction(key)}
              style={[s.reactionBtn, active && s.reactionBtnActive]}
            >
              <Text style={s.reactionEmoji}>{emoji}</Text>
              {count > 0 && (
                <Text style={[s.reactionCount, active && s.reactionCountActive]}>{count}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Action row: Share | Comment */}
      <View style={s.actionRow}>
        <TouchableOpacity
          style={s.actionBtn}
          onPress={() => Share.share({ message: post.caption ? `${post.caption}${post.image_url ? `\n${post.image_url}` : ""}` : (post.image_url ?? "Mirá este post en feedpod") })}
        >
          <Text style={s.actionBtnText}>🔁 Compartir</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.actionBtn, showComments && s.actionBtnActive]}
          onPress={() => setShowComments((v) => !v)}
        >
          <Text style={[s.actionBtnText, showComments && s.actionBtnTextActive]}>
            💬 {totalComments > 0 ? `${totalComments} comentario${totalComments !== 1 ? "s" : ""}` : "Comentar"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Comments section */}
      {showComments && (
        <View style={s.commentsSection}>
          {/* Sort toggle */}
          <View style={s.sortRow}>
            {(["top", "new"] as const).map((sort) => (
              <TouchableOpacity
                key={sort}
                onPress={() => setCommentSort(sort)}
                style={[s.sortBtn, commentSort === sort && s.sortBtnActive]}
              >
                <Text style={[s.sortBtnText, commentSort === sort && s.sortBtnTextActive]}>
                  {sort === "top" ? "Top" : "Nuevo"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* New comment input */}
          {replyTo && (
            <View style={s.replyingToRow}>
              <Text style={s.replyingToText}>Respondiendo a @{replyTo.username}</Text>
              <TouchableOpacity onPress={() => setReplyTo(null)}>
                <Text style={s.replyingToClose}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={s.commentInputRow}>
            <TextInput
              value={newComment}
              onChangeText={setNewComment}
              placeholder={replyTo ? `Responder...` : "Agregar comentario..."}
              placeholderTextColor="#555"
              style={s.commentInput}
              multiline
            />
            <TouchableOpacity
              onPress={handleSubmitComment}
              disabled={!newComment.trim() || submitting}
              style={[s.commentSend, (!newComment.trim() || submitting) && s.commentSendDisabled]}
            >
              <Text style={s.commentSendText}>{submitting ? "..." : "→"}</Text>
            </TouchableOpacity>
          </View>

          {/* Comment list */}
          {comments.length === 0 && commentsLoaded && (
            <Text style={s.noComments}>Sin comentarios aún. Sé el primero.</Text>
          )}
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              currentUserId={currentUserId}
              onVote={handleVote}
              onDelete={handleDeleteComment}
              onReply={(id, username) => setReplyTo({ id, username })}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ── CommentItem ───────────────────────────────────────────────────
function CommentItem({
  comment, currentUserId, onVote, onDelete, onReply, depth = 0,
}: {
  comment: CommentOut;
  currentUserId?: number;
  onVote: (id: number, vote: 1 | -1) => void;
  onDelete: (id: number) => void;
  onReply: (id: number, username: string) => void;
  depth?: number;
}) {
  return (
    <View style={[s.commentItem, depth > 0 && s.commentItemReply]}>
      <View style={s.commentHeader}>
        <Text style={s.commentAuthor}>{comment.display_name}</Text>
        <Text style={s.commentHandle}>@{comment.username}</Text>
      </View>
      <Text style={s.commentContent}>{comment.content}</Text>
      <View style={s.commentActions}>
        <TouchableOpacity onPress={() => onVote(comment.id, 1)} style={s.voteBtn}>
          <Text style={[s.voteArrow, comment.my_vote === 1 && s.voteUp]}>▲</Text>
        </TouchableOpacity>
        <Text style={[s.voteScore,
          comment.score > 0 && s.voteScorePos,
          comment.score < 0 && s.voteScoreNeg,
        ]}>
          {comment.score}
        </Text>
        <TouchableOpacity onPress={() => onVote(comment.id, -1)} style={s.voteBtn}>
          <Text style={[s.voteArrow, comment.my_vote === -1 && s.voteDown]}>▼</Text>
        </TouchableOpacity>
        {depth === 0 && (
          <TouchableOpacity onPress={() => onReply(comment.id, comment.username)} style={s.replyBtn}>
            <Text style={s.replyBtnText}>Responder</Text>
          </TouchableOpacity>
        )}
        {currentUserId === comment.user_id && (
          <TouchableOpacity onPress={() => onDelete(comment.id)} style={s.deleteBtn}>
            <Text style={s.deleteBtnText}>Eliminar</Text>
          </TouchableOpacity>
        )}
      </View>
      {comment.replies.map((r) => (
        <CommentItem key={r.id} comment={r} currentUserId={currentUserId}
          onVote={onVote} onDelete={onDelete} onReply={onReply} depth={depth + 1} />
      ))}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const RED = "#E63946";

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: "#0D0D0D" },

  // Header
  header:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#1A1A1A", borderBottomWidth: 1, borderBottomColor: "#2A2A2A" },
  logo:           { fontSize: 22, fontWeight: "900", color: RED },
  headerRight:    { flexDirection: "row", alignItems: "center", gap: 12 },
  headerUser:     { color: "#ccc", fontSize: 13 },
  headerIcon:     { fontSize: 16 },
  logoutBtn:      { color: "#555", fontSize: 13 },

  // Verify banner
  verifyBanner:   { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "rgba(120,80,0,0.3)", borderWidth: 1, borderColor: "rgba(180,120,0,0.4)", borderRadius: 14, marginHorizontal: 12, marginTop: 10, padding: 12 },
  verifyIcon:     { fontSize: 16, marginTop: 1 },
  verifyTitle:    { color: "#fbbf24", fontWeight: "600", fontSize: 13 },
  verifyText:     { color: "#fbbf24", fontSize: 13 },
  verifyLink:     { color: "#f59e0b", fontSize: 12, textDecorationLine: "underline", marginTop: 2 },
  verifyClose:    { color: "#92400e", fontSize: 22, lineHeight: 24, paddingLeft: 4 },

  // Tabs
  tabRow:         { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  tabBtn:         { flex: 1, paddingVertical: 10, borderRadius: 14, borderWidth: 2, borderColor: "#2A2A2A", alignItems: "center", backgroundColor: "#1A1A1A" },
  tabBtnActive:   { backgroundColor: RED, borderColor: RED },
  tabBtnText:     { fontWeight: "900", fontSize: 11, letterSpacing: 1, color: "#888", textTransform: "uppercase" },
  tabBtnTextActive: { color: "#fff" },

  // Circles row
  circlesContainer: { paddingTop: 10 },
  circlesScroll:  { paddingHorizontal: 12, gap: 10 },
  emptyCircles:   { color: "#444", fontSize: 11, paddingVertical: 12 },

  // Story circles
  storyCircleWrap:  { alignItems: "center", gap: 4 },
  storyCircle:      { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: "#333", overflow: "hidden", backgroundColor: "#1A1A1A", justifyContent: "center", alignItems: "center" },
  storyCircleActive: { borderColor: RED },
  storyCircleImg:   { width: 56, height: 56, borderRadius: 28 },
  storyCircleLetter: { color: "#666", fontSize: 20, fontWeight: "900" },
  storyCircleLabel: { color: "#888", fontSize: 10, width: 56, textAlign: "center" },

  // Community circles
  communityCircleWrap:  { alignItems: "center" },
  communityCircle:      { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: "transparent", justifyContent: "center", alignItems: "center" },
  communityCircleActive: { borderColor: RED },
  communityCircleLabel: { color: "#fff", fontWeight: "900", fontSize: 10, letterSpacing: 1 },

  // Content
  content:        { flex: 1, marginTop: 8 },
  empty:          { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyIcon:      { fontSize: 36, marginBottom: 8 },
  emptyText:      { color: "#444", fontSize: 13 },

  // Story viewer
  storyMedia:     { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  storyImage:     { width: "100%", height: "100%" },
  videoPlaceholder: { alignItems: "center", gap: 8 },
  videoPlaceholderText: { color: "#fff", fontSize: 32 },
  videoPlaceholderSub: { color: "#555", fontSize: 12 },
  hashtagOverlay: { position: "absolute", bottom: 12, right: 12, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  hashtagText:    { color: "#fff", fontSize: 11, fontWeight: "700" },
  storyInfo:      { backgroundColor: "#1A1A1A", padding: 12, borderTopWidth: 1, borderTopColor: "#2A2A2A" },
  storyInfoRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  storyUsername:  { color: "#fff", fontWeight: "700", fontSize: 14 },
  storyCounter:   { color: "#555", fontSize: 12 },
  storyCaption:   { color: "#aaa", fontSize: 13, marginBottom: 8 },
  storyNavRow:    { flexDirection: "row", gap: 8 },
  storyNavBtn:    { flex: 1, borderWidth: 1, borderColor: "#333", borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  storyNavBtnDisabled: { opacity: 0.25 },
  storyNavBtnText: { color: "#aaa", fontSize: 16 },

  // Onlys fan cards
  fanCard:        { flex: 1, height: 160, borderRadius: 16, overflow: "hidden", backgroundColor: "#1A1A1A" },
  fanCardOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  fanCardInfo:    { position: "absolute", bottom: 0, left: 0, right: 0, padding: 10 },
  fanCardName:    { color: "#fff", fontWeight: "900", fontSize: 13 },
  fanCardMembers: { color: "#aaa", fontSize: 11 },

  // Community bar
  communityBar:   { flexDirection: "row", alignItems: "center", margin: 12, backgroundColor: "#1A1A1A", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: "#2A2A2A" },
  communityName:  { color: "#fff", fontWeight: "700", fontSize: 14 },
  communityMembers: { color: "#555", fontSize: 12 },
  joinBtn:        { backgroundColor: RED, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  joinBtnText:    { color: "#fff", fontWeight: "700", fontSize: 12 },

  // Community filter bar (member)
  filterRow:          { flexDirection: "row", flex: 1, gap: 4 },
  filterBtn:          { flex: 1, paddingVertical: 7, borderRadius: 10, backgroundColor: "#2A2A2A", alignItems: "center" },
  filterBtnActive:    { backgroundColor: RED },
  filterBtnText:      { color: "#777", fontSize: 11, fontWeight: "700" },
  filterBtnTextActive: { color: "#fff" },
  menuBtn:            { width: 36, height: 36, borderRadius: 8, backgroundColor: "#2A2A2A", justifyContent: "center", alignItems: "center", marginLeft: 8 },
  menuBtnText:        { color: "#fff", fontSize: 18, lineHeight: 20 },
  menuDropdown:       { position: "absolute", right: 0, top: 42, backgroundColor: "#1E1E1E", borderRadius: 10, borderWidth: 1, borderColor: "#333", minWidth: 150, zIndex: 100, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 8, elevation: 10 },
  menuItem:           { paddingHorizontal: 16, paddingVertical: 12 },
  menuItemBorder:     { borderTopWidth: 1, borderTopColor: "#2A2A2A" },
  menuItemText:       { color: "#ccc", fontSize: 13, fontWeight: "600" },
  menuItemDanger:     { color: RED },

  // PostCard
  postCard:       { backgroundColor: "#1A1A1A", marginHorizontal: 12, marginBottom: 10, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#2A2A2A" },
  postHeader:     { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  postAvatar:     { width: 36, height: 36, borderRadius: 18, backgroundColor: "#2A2A2A", justifyContent: "center", alignItems: "center", overflow: "hidden" },
  postAvatarImg:  { width: 36, height: 36, borderRadius: 18 },
  postAvatarLetter: { color: RED, fontSize: 16, fontWeight: "900" },
  postDisplayName: { color: "#fff", fontWeight: "700", fontSize: 14 },
  postUsername:   { color: "#555", fontSize: 12 },
  reportBtn:      { padding: 6 },
  reportBtnText:  { fontSize: 16 },
  postImage:      { width: "100%", height: 240 },
  postCaption:    { color: "#ccc", fontSize: 14, padding: 12 },

  // Reactions
  reactionsRow:      { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#2A2A2A" },
  reactionBtn:       { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: "transparent", backgroundColor: "#1A1A1A" },
  reactionBtnActive: { backgroundColor: "rgba(230,57,70,0.15)", borderColor: "rgba(230,57,70,0.4)" },
  reactionEmoji:     { fontSize: 16 },
  reactionCount:     { color: "#666", fontSize: 11, fontWeight: "700" },
  reactionCountActive: { color: RED },

  // Action row (share | comment)
  actionRow:           { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#2A2A2A" },
  actionBtn:           { flex: 1, paddingHorizontal: 12, paddingVertical: 10, alignItems: "center" },
  actionBtnActive:     { borderBottomWidth: 2, borderBottomColor: "#4A90E2" },
  actionBtnText:       { color: "#555", fontSize: 12, fontWeight: "600" },
  actionBtnTextActive: { color: "#4A90E2" },

  // Comments section
  commentsSection:   { borderTopWidth: 1, borderTopColor: "#2A2A2A", paddingHorizontal: 12, paddingBottom: 8 },
  sortRow:           { flexDirection: "row", gap: 6, paddingVertical: 8 },
  sortBtn:           { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: "#2A2A2A" },
  sortBtnActive:     { backgroundColor: "#3A3A3A" },
  sortBtnText:       { color: "#666", fontSize: 11, fontWeight: "700" },
  sortBtnTextActive: { color: "#fff" },

  replyingToRow:   { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  replyingToText:  { color: "#888", fontSize: 11, flex: 1 },
  replyingToClose: { color: "#555", fontSize: 14 },

  commentInputRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  commentInput:    { flex: 1, backgroundColor: "#2A2A2A", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: "#fff", fontSize: 13, borderWidth: 1, borderColor: "#333" },
  commentSend:     { backgroundColor: RED, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, justifyContent: "center" },
  commentSendDisabled: { opacity: 0.4 },
  commentSendText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  noComments:      { color: "#444", fontSize: 12, textAlign: "center", paddingVertical: 12 },

  commentItem:     { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#222" },
  commentItemReply: { marginLeft: 16, borderLeftWidth: 2, borderLeftColor: "#2A2A2A", paddingLeft: 10 },
  commentHeader:   { flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 3 },
  commentAuthor:   { color: "#fff", fontWeight: "700", fontSize: 12 },
  commentHandle:   { color: "#555", fontSize: 11 },
  commentContent:  { color: "#ccc", fontSize: 13, lineHeight: 18, marginBottom: 4 },
  commentActions:  { flexDirection: "row", alignItems: "center", gap: 8 },
  voteBtn:         { padding: 2 },
  voteArrow:       { color: "#555", fontSize: 12, fontWeight: "900" },
  voteUp:          { color: "#4CAF50" },
  voteDown:        { color: RED },
  voteScore:       { color: "#666", fontSize: 12, fontWeight: "700", minWidth: 20, textAlign: "center" },
  voteScorePos:    { color: "#4CAF50" },
  voteScoreNeg:    { color: RED },
  replyBtn:        { marginLeft: 4 },
  replyBtnText:    { color: "#666", fontSize: 11 },
  deleteBtn:       { marginLeft: 4 },
  deleteBtnText:   { color: "#555", fontSize: 11 },

  // FAB
  fabContainer:   { position: "absolute", bottom: 25, right: 25, alignItems: "center" },
  fabMain:        { width: 56, height: 56, borderRadius: 28, backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#333", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  fabIcon:        { color: "#fff", fontSize: 28, lineHeight: 32, fontWeight: "200" },
  fabSub:         { position: "absolute", bottom: 0 },
  fabSubBtn:      { width: 56, height: 56, borderRadius: 28, backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#333", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  fabSubLabel:    { color: "#fff", fontSize: 9, fontWeight: "700", textAlign: "center", lineHeight: 12 },
});
