import { useEffect } from "react";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { View, ActivityIndicator } from "react-native";

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    SecureStore.getItemAsync("token").then((token) => {
      router.replace(token ? "/feed" : "/login");
    });
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: "#0D0D0D", justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator color="#E63946" />
    </View>
  );
}
