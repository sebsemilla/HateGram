import { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, FlatList, TouchableOpacity,
  Image, StyleSheet, Alert, ActivityIndicator, Animated, Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { postApi, communityApi, storyApi, StoryGroup } from "../lib/api";

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
  const [section, setSection]             = useState<Section>(null);
  const [posts, setPosts]                 = useState<any[]>([]);
  const [fanGroups, setFanGroups]         = useState<any[]>([]);
  const [community, setCommunity]         = useState<any>(null);
  const [communityPosts, setCommunityPosts] = useState<any[]>([]);
  const [joining, setJoining]             = useState(false);
  const [loading, setLoading]             = useState(false);

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
      Promise.all([
        communityApi.get(slug).then(setCommunity),
        communityApi.feed(slug).then(setCommunityPosts),
      ]).catch(console.error).finally(() => setLoading(false));
    }
  }, [section]);

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

  async function handleJoinLeave() {
    if (!community) return;
    const slug = ORIENTATION_SLUGS[section!]!;
    setJoining(true);
    try {
      if (community.is_member) {
        await communityApi.leave(slug);
        setCommunity((c: any) => ({ ...c, is_member: false, member_count: c.member_count - 1 }));
      } else {
        await communityApi.join(slug);
        setCommunity((c: any) => ({ ...c, is_member: true, member_count: c.member_count + 1 }));
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setJoining(false);
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
        <Text style={s.logo}>HateGram</Text>
        <View style={s.headerRight}>
          {user && (
            <TouchableOpacity onPress={() => router.push(`/profile/${user.username}`)}>
              <Text style={s.headerUser}>@{user.username}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={logout}>
            <Text style={s.logoutBtn}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

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
            renderItem={({ item }) => <PostCard post={item} />}
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
              <View style={s.communityBar}>
                <View style={{ flex: 1 }}>
                  <Text style={s.communityName}>{community.name}</Text>
                  <Text style={s.communityMembers}>{community.member_count} miembros</Text>
                </View>
                <TouchableOpacity
                  style={[s.joinBtn, community.is_member && s.joinBtnLeave]}
                  onPress={handleJoinLeave}
                  disabled={joining}
                >
                  <Text style={[s.joinBtnText, community.is_member && s.joinBtnLeaveText]}>
                    {joining ? "..." : community.is_member ? "Salir" : "Unirse"}
                  </Text>
                </TouchableOpacity>
              </View>
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
              renderItem={({ item }) => <PostCard post={item} />}
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

// ── PostCard ──────────────────────────────────────────────────────
function PostCard({ post }: { post: any }) {
  return (
    <View style={s.postCard}>
      <View style={s.postHeader}>
        <View style={s.postAvatar}>
          {post.avatar_url ? (
            <Image source={{ uri: post.avatar_url }} style={s.postAvatarImg} />
          ) : (
            <Text style={s.postAvatarLetter}>{(post.display_name || post.username)[0]}</Text>
          )}
        </View>
        <View>
          <Text style={s.postDisplayName}>{post.display_name || post.username}</Text>
          <Text style={s.postUsername}>@{post.username}</Text>
        </View>
      </View>
      {post.image_url ? (
        <Image source={{ uri: post.image_url }} style={s.postImage} resizeMode="cover" />
      ) : null}
      {post.caption ? <Text style={s.postCaption}>{post.caption}</Text> : null}
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
  logoutBtn:      { color: "#555", fontSize: 13 },

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
  joinBtnLeave:   { backgroundColor: "transparent", borderWidth: 1, borderColor: "#555" },
  joinBtnText:    { color: "#fff", fontWeight: "700", fontSize: 12 },
  joinBtnLeaveText: { color: "#aaa" },

  // PostCard
  postCard:       { backgroundColor: "#1A1A1A", marginHorizontal: 12, marginBottom: 10, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#2A2A2A" },
  postHeader:     { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  postAvatar:     { width: 36, height: 36, borderRadius: 18, backgroundColor: "#2A2A2A", justifyContent: "center", alignItems: "center", overflow: "hidden" },
  postAvatarImg:  { width: 36, height: 36, borderRadius: 18 },
  postAvatarLetter: { color: RED, fontSize: 16, fontWeight: "900" },
  postDisplayName: { color: "#fff", fontWeight: "700", fontSize: 14 },
  postUsername:   { color: "#555", fontSize: 12 },
  postImage:      { width: "100%", height: 240 },
  postCaption:    { color: "#ccc", fontSize: 14, padding: 12 },

  // FAB
  fabContainer:   { position: "absolute", bottom: 25, right: 25, alignItems: "center" },
  fabMain:        { width: 56, height: 56, borderRadius: 28, backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#333", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  fabIcon:        { color: "#fff", fontSize: 28, lineHeight: 32, fontWeight: "200" },
  fabSub:         { position: "absolute", bottom: 0 },
  fabSubBtn:      { width: 56, height: 56, borderRadius: 28, backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#333", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  fabSubLabel:    { color: "#fff", fontSize: 9, fontWeight: "700", textAlign: "center", lineHeight: 12 },
});
