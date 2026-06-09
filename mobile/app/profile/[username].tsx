import { useEffect, useState } from "react";
import {
  View, Text, Image, TouchableOpacity, TextInput,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { profiles } from "../../lib/api";

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
  location: string;
  website: string;
  badges: Badge[];
}

export default function ProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isMe, setIsMe] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ display_name: "", bio: "", location: "", website: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync("user").then((u) => {
      if (!u) { router.replace("/login"); return; }
      const user = JSON.parse(u);
      setIsMe(user.username === username);
    });
    profiles.get(username!).then((p) => {
      setProfile(p);
      setForm({ display_name: p.display_name, bio: p.bio, location: p.location, website: p.website });
    }).catch(() => router.replace("/feed"));
  }, [username]);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await profiles.update(form);
      setProfile(updated);
      setEditing(false);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return (
    <View style={s.center}>
      <ActivityIndicator color="#E63946" />
    </View>
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20 }}>
      {/* Profile card */}
      <View style={s.card}>
        <View style={s.avatarWrap}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={s.avatar} />
          ) : (
            <Text style={s.avatarLetter}>{profile.display_name[0]}</Text>
          )}
        </View>
        <Text style={s.name}>{profile.display_name}</Text>
        <Text style={s.username}>@{profile.username}</Text>
        {profile.location ? <Text style={s.meta}>{profile.location}</Text> : null}
        {profile.bio ? <Text style={s.bio}>{profile.bio}</Text> : null}
        {profile.website ? <Text style={s.website}>{profile.website}</Text> : null}

        {/* Badges */}
        {profile.badges?.length > 0 && (
          <View style={s.badgesRow}>
            {profile.badges.map((badge) => (
              <View
                key={badge.slug}
                style={[s.badge, { borderColor: badge.color, backgroundColor: `${badge.color}18` }]}
              >
                <Text style={s.badgeIcon}>{badge.icon}</Text>
                <Text style={[s.badgeName, { color: badge.color }]}>{badge.name}</Text>
                <Text style={[s.badgeScore, { color: badge.color }]}>·{badge.score}</Text>
              </View>
            ))}
          </View>
        )}

        {isMe && !editing && (
          <TouchableOpacity style={s.editBtn} onPress={() => setEditing(true)}>
            <Text style={s.editBtnText}>Editar perfil</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Edit form */}
      {isMe && editing && (
        <View style={s.card}>
          <Text style={s.sectionTitle}>Editar perfil</Text>
          {[
            { label: "Nombre", key: "display_name" },
            { label: "Bio", key: "bio" },
            { label: "Ubicación", key: "location" },
            { label: "Website", key: "website" },
          ].map(({ label, key }) => (
            <View key={key}>
              <Text style={s.label}>{label}</Text>
              <TextInput
                style={s.input}
                value={form[key as keyof typeof form]}
                onChangeText={(v) => setForm({ ...form, [key]: v })}
                placeholderTextColor="#555"
                autoCapitalize="none"
              />
            </View>
          ))}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
            <TouchableOpacity style={[s.btn, { flex: 1 }]} onPress={handleSave} disabled={saving}>
              <Text style={s.btnText}>{saving ? "Guardando..." : "Guardar"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnOutline, { flex: 1 }]} onPress={() => setEditing(false)}>
              <Text style={s.btnOutlineText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D0D" },
  center: { flex: 1, backgroundColor: "#0D0D0D", justifyContent: "center", alignItems: "center" },
  card: { backgroundColor: "#1A1A1A", borderRadius: 16, padding: 20, marginBottom: 16, alignItems: "center" },
  avatarWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#2A2A2A", justifyContent: "center", alignItems: "center", marginBottom: 12, overflow: "hidden" },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarLetter: { color: "#E63946", fontSize: 32, fontWeight: "900" },
  name: { fontSize: 22, fontWeight: "900", color: "#fff" },
  username: { color: "#666", marginTop: 2 },
  meta: { color: "#555", fontSize: 13, marginTop: 4 },
  bio: { color: "#aaa", textAlign: "center", marginTop: 8, lineHeight: 20 },
  website: { color: "#E63946", marginTop: 6, fontSize: 13 },
  editBtn: { marginTop: 16, borderWidth: 1, borderColor: "#444", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 30 },
  editBtnText: { color: "#aaa", fontWeight: "600" },
  sectionTitle: { color: "#aaa", fontWeight: "700", marginBottom: 8, alignSelf: "flex-start" },
  label: { color: "#999", fontSize: 13, marginTop: 10, alignSelf: "flex-start" },
  input: { backgroundColor: "#2A2A2A", borderRadius: 10, padding: 12, color: "#fff", borderWidth: 1, borderColor: "#333", width: "100%" },
  btn: { backgroundColor: "#E63946", borderRadius: 10, padding: 12, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
  btnOutline: { borderWidth: 1, borderColor: "#444", borderRadius: 10, padding: 12, alignItems: "center" },
  btnOutlineText: { color: "#aaa" },
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, justifyContent: "center" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeIcon: { fontSize: 13 },
  badgeName: { fontSize: 12, fontWeight: "700" },
  badgeScore: { fontSize: 11, opacity: 0.6, fontFamily: "monospace" },
});
