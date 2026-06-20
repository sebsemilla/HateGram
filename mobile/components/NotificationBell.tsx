import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { notifApi } from "../lib/api";

export default function NotificationBell() {
  const router = useRouter();
  const [count, setCount] = useState(0);

  useEffect(() => {
    function fetchCount() {
      notifApi.unreadCount().then((r) => setCount(r.count)).catch(() => {});
    }
    fetchCount();
    const id = setInterval(fetchCount, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <TouchableOpacity
      style={s.wrap}
      onPress={() => { setCount(0); router.push("/notifications" as any); }}
      activeOpacity={0.7}
    >
      <Text style={s.icon}>🔔</Text>
      {count > 0 && (
        <View style={s.badge}>
          <Text style={s.badgeText}>{count > 99 ? "99+" : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap:      { position: "relative", padding: 2 },
  icon:      { fontSize: 18 },
  badge:     { position: "absolute", top: -2, right: -4, backgroundColor: "#e11d48", borderRadius: 10, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});
