import { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { notifApi } from "../lib/api";

interface Notif {
  id: number;
  type: string;
  body: string;
  is_read: boolean;
  link: string | null;
  actor_username: string | null;
  created_at: string;
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await notifApi.list();
      setNotifs(list);
      notifApi.markAllRead().catch(() => {});
    } catch {
      setNotifs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handlePress(n: Notif) {
    if (!n.is_read) notifApi.markRead(n.id).catch(() => {});
    if (n.link) {
      router.push(n.link as any);
    }
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Notificaciones</Text>
        {notifs.some((n) => !n.is_read) && (
          <TouchableOpacity
            onPress={() => { notifApi.markAllRead(); setNotifs((p) => p.map((n) => ({ ...n, is_read: true }))); }}
          >
            <Text style={s.markAll}>Leer todo</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color="#22d3ee" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(n) => String(n.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#22d3ee" />}
          contentContainerStyle={notifs.length === 0 ? s.empty : undefined}
          ListEmptyComponent={<Text style={s.emptyText}>Sin notificaciones</Text>}
          renderItem={({ item: n }) => (
            <TouchableOpacity
              style={[s.item, !n.is_read && s.itemUnread]}
              onPress={() => handlePress(n)}
              activeOpacity={0.7}
            >
              <View style={s.iconWrap}>
                <Text style={s.icon}>🔔</Text>
              </View>
              <View style={s.itemBody}>
                <Text style={s.itemText}>{n.body}</Text>
                <Text style={s.itemTime}>{timeAgo(n.created_at)}</Text>
              </View>
              {!n.is_read && <View style={s.dot} />}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: "#0D0D0D" },
  header:     { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#222", gap: 12 },
  backBtn:    { padding: 2 },
  backText:   { color: "#aaa", fontSize: 20 },
  title:      { flex: 1, color: "#fff", fontWeight: "700", fontSize: 16 },
  markAll:    { color: "#555", fontSize: 13 },
  item:       { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#1A1A1A" },
  itemUnread: { backgroundColor: "rgba(34,211,238,0.04)" },
  iconWrap:   { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1A1A1A", alignItems: "center", justifyContent: "center", shrink: 0 } as any,
  icon:       { fontSize: 18 },
  itemBody:   { flex: 1 },
  itemText:   { color: "#e5e5e5", fontSize: 14, lineHeight: 20 },
  itemTime:   { color: "#555", fontSize: 12, marginTop: 2 },
  dot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: "#e11d48" },
  empty:      { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText:  { color: "#555", fontSize: 14 },
});
