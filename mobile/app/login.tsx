import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter, Link } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { auth } from "../lib/api";

export default function LoginScreen() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin() {
    if (!form.username || !form.password) return;
    setLoading(true);
    try {
      const data = await auth.login(form);
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
      <Text style={s.logo}>HateGram</Text>
      <Text style={s.subtitle}>La red social sin filtros</Text>

      <View style={s.card}>
        <Text style={s.label}>Username o email</Text>
        <TextInput
          style={s.input}
          autoCapitalize="none"
          keyboardType="email-address"
          value={form.username}
          onChangeText={(v) => setForm({ ...form, username: v })}
          placeholderTextColor="#555"
        />
        <Text style={s.label}>Contraseña</Text>
        <View style={s.passwordWrapper}>
          <TextInput
            style={s.passwordInput}
            secureTextEntry={!showPassword}
            value={form.password}
            onChangeText={(v) => setForm({ ...form, password: v })}
            placeholderTextColor="#555"
          />
          <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={s.eyeBtn}>
            <Text style={s.eyeIcon}>{showPassword ? "🙈" : "👁"}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleLogin} disabled={loading}>
          <Text style={s.btnText}>{loading ? "Ingresando..." : "Ingresar"}</Text>
        </TouchableOpacity>
      </View>

      <Link href="/register" style={s.link}>¿No tenés cuenta? Registrate</Link>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D0D", justifyContent: "center", padding: 24 },
  logo: { fontSize: 40, fontWeight: "900", color: "#E63946", textAlign: "center" },
  subtitle: { color: "#666", textAlign: "center", marginBottom: 32, marginTop: 4 },
  card: { backgroundColor: "#1A1A1A", borderRadius: 16, padding: 20, gap: 8 },
  label: { color: "#999", fontSize: 13, marginTop: 8 },
  input: { backgroundColor: "#2A2A2A", borderRadius: 10, padding: 12, color: "#fff", borderWidth: 1, borderColor: "#333" },
  passwordWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: "#2A2A2A", borderRadius: 10, borderWidth: 1, borderColor: "#333" },
  passwordInput: { flex: 1, padding: 12, color: "#fff" },
  eyeBtn: { paddingHorizontal: 12, justifyContent: "center" },
  eyeIcon: { fontSize: 18 },
  btn: { backgroundColor: "#E63946", borderRadius: 10, padding: 14, marginTop: 12, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  link: { color: "#E63946", textAlign: "center", marginTop: 20 },
});
