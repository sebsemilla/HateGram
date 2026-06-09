import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#1A1A1A" },
          headerTintColor: "#E63946",
          headerTitleStyle: { fontWeight: "900" },
          contentStyle: { backgroundColor: "#0D0D0D" },
        }}
      />
    </>
  );
}
