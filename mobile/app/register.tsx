import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { useRouter, Link } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { auth } from "../lib/api";

export default function RegisterScreen() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!form.username || !form.email || !form.password) return;
    setLoading(true);
    try {
      const data = await auth.register(form);
      await SecureStore.setItemAsync("token", data.access_token);
      await SecureStore.setItemAsync("user", JSON.stringify(data.user));
      router.replace("/feed");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.logo}>feedpod</Text>
        <Text style={s.subtitle}>Unite a la red sin filtros</Text>

        <View style={s.card}>
          {[
            { label: "Username", key: "username", keyboard: "default" as const },
            { label: "Email", key: "email", keyboard: "email-address" as const },
            { label: "Contraseña", key: "password", keyboard: "default" as const, secure: true },
          ].map(({ label, key, keyboard, secure }) => (
            <View key={key}>
              <Text style={s.label}>{label}</Text>
              <TextInput
                style={s.input}
                autoCapitalize="none"
                keyboardType={keyboard}
                secureTextEntry={secure}
                value={form[key as keyof typeof form]}
                onChangeText={(v) => setForm({ ...form, [key]: v })}
                placeholderTextColor="#555"
              />
            </View>
          ))}
          <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleRegister} disabled={loading}>
            <Text style={s.btnText}>{loading ? "Creando cuenta..." : "Crear cuenta"}</Text>
          </TouchableOpacity>
        </View>

        <Link href="/login" style={s.link}>¿Ya tenés cuenta? Ingresá</Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D0D" },
  scroll: { justifyContent: "center", padding: 24, flexGrow: 1 },
  logo: { fontSize: 40, fontWeight: "900", color: "#E63946", textAlign: "center" },
  subtitle: { color: "#666", textAlign: "center", marginBottom: 32, marginTop: 4 },
  card: { backgroundColor: "#1A1A1A", borderRadius: 16, padding: 20, gap: 8 },
  label: { color: "#999", fontSize: 13, marginTop: 8 },
  input: { backgroundColor: "#2A2A2A", borderRadius: 10, padding: 12, color: "#fff", borderWidth: 1, borderColor: "#333" },
  btn: { backgroundColor: "#E63946", borderRadius: 10, padding: 14, marginTop: 12, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  link: { color: "#E63946", textAlign: "center", marginTop: 20 },
});
