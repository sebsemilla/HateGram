import { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  Image, StyleSheet, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { searchApi } from "../lib/api";

const API_URL = "http://localhost:8000";

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
  username: string;
  display_name: string;
  avatar_url: string;
}

export default function SearchScreen() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [users, setUsers] = useState<UserResult[]>([]);
  const [posts, setPosts] = useState<PostResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(q, tab), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [q, tab, doSearch]);

  async function toggleFollow(user: UserResult) {
    await searchApi.follow(user.username);
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_following: !u.is_following } : u));
  }

  function avatarUri(url: string) {
    if (!url) return null;
    return url.startsWith("http") ? url : `${API_URL}${url}`;
  }

  const showUsers = tab === "all" || tab === "users";
  const showPosts = tab === "all" || tab === "posts";

  const items: Array<{ type: "header-users" | "header-posts" | "user" | "post"; data?: UserResult | PostResult }> = [];
  if (q && !loading) {
    if (showUsers && users.length > 0) {
      if (tab === "all") items.push({ type: "header-users" });
      users.forEach((u) => items.push({ type: "user", data: u }));
    }
    if (showPosts && posts.length > 0) {
      if (tab === "all") items.push({ type: "header-posts" });
      posts.forEach((p) => items.push({ type: "post", data: p }));
    }
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <View style={s.inputWrap}>
          <Text style={s.inputIcon}>🔍</Text>
          <TextInput
            style={s.input}
            placeholder="Buscar usuarios o posts..."
            placeholderTextColor="#666"
            value={q}
            onChangeText={setQ}
            autoFocus
            returnKeyType="search"
          />
          {q ? <TouchableOpacity onPress={() => setQ("")}><Text style={s.clearBtn}>×</Text></TouchableOpacity> : null}
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(["all", "users", "posts"] as Tab[]).map((t) => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === "all" ? "Todo" : t === "users" ? "Usuarios" : "Posts"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && <ActivityIndicator color="#22d3ee" style={{ marginTop: 32 }} />}

      {!loading && !q && (
        <Text style={s.emptyText}>Escribí algo para buscar</Text>
      )}

      {!loading && q && items.length === 0 && (
        <Text style={s.emptyText}>Sin resultados para "{q}"</Text>
      )}

      <FlatList
        data={items}
        keyExtractor={(item, i) => `${item.type}-${i}`}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        renderItem={({ item }) => {
          if (item.type === "header-users") return <Text style={s.sectionHeader}>USUARIOS</Text>;
          if (item.type === "header-posts") return <Text style={[s.sectionHeader, { marginTop: 12 }]}>POSTS</Text>;

          if (item.type === "user") {
            const u = item.data as UserResult;
            const uri = avatarUri(u.avatar_url);
            return (
              <TouchableOpacity style={s.userCard} onPress={() => router.push(`/profile/${u.username}` as any)}>
                {uri ? <Image source={{ uri }} style={s.avatar} /> : <View style={[s.avatar, s.avatarFallback]}><Text style={s.avatarLetter}>{u.display_name[0]?.toUpperCase()}</Text></View>}
                <View style={s.userInfo}>
                  <Text style={s.displayName}>{u.display_name}</Text>
                  <Text style={s.username}>@{u.username}</Text>
                  {u.bio ? <Text style={s.bio} numberOfLines={1}>{u.bio}</Text> : null}
                </View>
                <TouchableOpacity
                  style={[s.followBtn, u.is_following && s.followingBtn]}
                  onPress={() => toggleFollow(u)}
                >
                  <Text style={[s.followBtnText, u.is_following && s.followingBtnText]}>
                    {u.is_following ? "Siguiendo" : "Seguir"}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }

          if (item.type === "post") {
            const p = item.data as PostResult;
            const uri = avatarUri(p.avatar_url);
            const imgUri = p.image_url ? (p.image_url.startsWith("http") ? p.image_url : `${API_URL}${p.image_url}`) : null;
            return (
              <TouchableOpacity style={s.postCard} onPress={() => router.push(`/profile/${p.username}` as any)}>
                <View style={s.postHeader}>
                  {uri ? <Image source={{ uri }} style={s.avatarSm} /> : <View style={[s.avatarSm, s.avatarFallback]}><Text style={s.avatarLetterSm}>{p.display_name[0]?.toUpperCase()}</Text></View>}
                  <Text style={s.displayName}>{p.display_name}</Text>
                  <Text style={s.usernameSm}> @{p.username}</Text>
                </View>
                {imgUri && <Image source={{ uri: imgUri }} style={s.postImage} resizeMode="cover" />}
                {p.caption ? <Text style={s.caption} numberOfLines={3}>{p.caption}</Text> : null}
              </TouchableOpacity>
            );
          }
          return null;
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D0D" },
  header: { flexDirection: "row", alignItems: "center", padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: "#222" },
  backBtn: { padding: 4 },
  backText: { color: "#aaa", fontSize: 20 },
  inputWrap: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#1A1A1A", borderRadius: 12, paddingHorizontal: 12, height: 42 },
  inputIcon: { fontSize: 14, marginRight: 6 },
  input: { flex: 1, color: "#fff", fontSize: 14 },
  clearBtn: { color: "#666", fontSize: 22, lineHeight: 26, paddingLeft: 6 },
  tabs: { flexDirection: "row", margin: 12, backgroundColor: "#1A1A1A", borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  tabActive: { backgroundColor: "#2A2A2A" },
  tabText: { color: "#666", fontSize: 13, fontWeight: "500" },
  tabTextActive: { color: "#fff" },
  emptyText: { color: "#555", textAlign: "center", marginTop: 48, fontSize: 14 },
  sectionHeader: { color: "#555", fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginBottom: 4 },
  userCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#1A1A1A", borderRadius: 14, padding: 12, gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarSm: { width: 28, height: 28, borderRadius: 14 },
  avatarFallback: { backgroundColor: "#333", alignItems: "center", justifyContent: "center" },
  avatarLetter: { color: "#aaa", fontWeight: "700", fontSize: 16 },
  avatarLetterSm: { color: "#aaa", fontWeight: "700", fontSize: 12 },
  userInfo: { flex: 1 },
  displayName: { color: "#fff", fontWeight: "600", fontSize: 14 },
  username: { color: "#666", fontSize: 12 },
  bio: { color: "#888", fontSize: 12, marginTop: 2 },
  followBtn: { backgroundColor: "rgba(34,211,238,0.15)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  followingBtn: { backgroundColor: "#2A2A2A" },
  followBtnText: { color: "#22d3ee", fontSize: 12, fontWeight: "600" },
  followingBtnText: { color: "#888" },
  postCard: { backgroundColor: "#1A1A1A", borderRadius: 14, padding: 12 },
  postHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  usernameSm: { color: "#666", fontSize: 12 },
  postImage: { width: "100%", height: 160, borderRadius: 10, marginBottom: 8 },
  caption: { color: "#ccc", fontSize: 13, lineHeight: 18 },
});
