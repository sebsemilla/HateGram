/**
 * Requiere instalar antes de usar cámara/galería:
 *   npx expo install expo-image-picker
 */
import { useState, useEffect, useRef } from "react";
import {
  View, Text, FlatList, TouchableOpacity, Image, TextInput,
  ScrollView, StyleSheet, Alert, ActivityIndicator,
  Pressable, Modal, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { postApi, storyApi, uploadMedia, fetchLinkPreview, StoryCreateData } from "../../lib/api";

// expo-image-picker importado dinámicamente para no romper si no está instalado
let ImagePicker: any = null;
try { ImagePicker = require("expo-image-picker"); } catch {}

type Screen = "picker" | "editor";
type Mode   = "upload" | "link" | "post";

const FILTER_TAGS = [
  { value: "",         label: "Recientes" },
  { value: "gay",      label: "GZone"     },
  { value: "lesbiana", label: "LZone"     },
  { value: "hetero",   label: "HZone"     },
];

const EDITOR_TOOLS = [
  { icon: "T",  label: "Texto"    },
  { icon: "✂",  label: "Recorte"  },
  { icon: "◑",  label: "Filtros"  },
  { icon: "✏",  label: "Dibujo"   },
  { icon: "★",  label: "Stickers" },
];

const RED = "#E63946";

export default function CreateStoryScreen() {
  const router = useRouter();

  // ── Screens & mode ────────────────────────────────────────────
  const [screen, setScreen] = useState<Screen>("picker");
  const [mode, setMode]     = useState<Mode>("upload");
  const [filter, setFilter] = useState("");

  // ── Posts grid ────────────────────────────────────────────────
  const [myPosts, setMyPosts]   = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  // ── Selection ─────────────────────────────────────────────────
  const [selected, setSelected]   = useState<any[]>([]);
  const [multiMode, setMultiMode] = useState(false);

  // ── Uploaded media ────────────────────────────────────────────
  const [uploadedMedia, setUploadedMedia] = useState<{ url: string; media_type: "image" | "video" } | null>(null);

  // ── Link mode ─────────────────────────────────────────────────
  const [linkUrl,      setLinkUrl]      = useState("");
  const [linkImage,    setLinkImage]    = useState("");
  const [fetchingLink, setFetchingLink] = useState(false);

  // ── Editor ────────────────────────────────────────────────────
  const [caption,    setCaption]    = useState("");
  const [hashtag,    setHashtag]    = useState("");
  const [publishing, setPublishing] = useState(false);
  const [pubProgress, setPubProgress] = useState<{ done: number; total: number } | null>(null);

  // ── Set Time ──────────────────────────────────────────────────
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [publishAt,      setPublishAt]      = useState("");

  // ── Load posts ────────────────────────────────────────────────
  useEffect(() => {
    setLoadingPosts(true);
    postApi.mineWithMedia().then(setMyPosts).catch(console.error).finally(() => setLoadingPosts(false));
  }, []);

  // ── Filtered posts ────────────────────────────────────────────
  const filteredPosts = filter
    ? myPosts.filter((p) => p.community_slug === filter)
    : myPosts;

  // ──────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────

  function resetPicker() {
    setSelected([]);
    setMultiMode(false);
    setUploadedMedia(null);
    setLinkUrl("");
    setLinkImage("");
    setCaption("");
    setHashtag("");
    setPublishAt("");
  }

  function goToEditor(items: any[]) {
    setSelected(items);
    setScreen("editor");
  }

  // ── Image picker (galería del dispositivo) ────────────────────
  async function openGallery() {
    if (!ImagePicker) {
      Alert.alert("Falta instalar", "Ejecutá: npx expo install expo-image-picker");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permiso necesario", "Habilitá acceso a la galería"); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset    = result.assets[0];
    const mimeType = asset.type === "video" ? "video/mp4" : "image/jpeg";
    setPublishing(true);
    try {
      const uploaded = await uploadMedia(asset.uri, mimeType);
      setUploadedMedia(uploaded);
      goToEditor([{ id: "__gallery", image_url: uploaded.url, media_type: uploaded.media_type }]);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setPublishing(false);
    }
  }

  // ── Camera ────────────────────────────────────────────────────
  async function openCamera() {
    if (!ImagePicker) {
      Alert.alert("Falta instalar", "Ejecutá: npx expo install expo-image-picker");
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permiso necesario", "Habilitá acceso a la cámara"); return; }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset    = result.assets[0];
    const mimeType = asset.type === "video" ? "video/mp4" : "image/jpeg";
    setPublishing(true);
    try {
      const uploaded = await uploadMedia(asset.uri, mimeType);
      setUploadedMedia(uploaded);
      goToEditor([{ id: "__camera", image_url: uploaded.url, media_type: uploaded.media_type }]);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setPublishing(false);
    }
  }

  // ── Select post from grid ─────────────────────────────────────
  function onSelectPost(post: any) {
    if (multiMode) {
      setSelected((prev) =>
        prev.find((p) => p.id === post.id)
          ? prev.filter((p) => p.id !== post.id)
          : [...prev, post]
      );
    } else {
      goToEditor([post]);
    }
  }

  // ── Link preview ──────────────────────────────────────────────
  async function doFetchLink() {
    if (!linkUrl) return;
    setFetchingLink(true);
    try {
      const data = await fetchLinkPreview(linkUrl);
      setLinkImage(data.image || "");
    } catch {
      setLinkImage("");
    } finally {
      setFetchingLink(false);
    }
  }

  // ── Publish ───────────────────────────────────────────────────
  async function publish(scheduleAt?: string) {
    setPublishing(true);
    try {
      if (mode === "link") {
        await storyApi.create({
          media_url:  linkImage || "",
          media_type: "image",
          caption,
          hashtag,
          link_url:   linkUrl,
          link_image: linkImage,
          publish_at: scheduleAt || null,
        });
        router.replace("/feed");
        return;
      }

      setPubProgress({ done: 0, total: selected.length });
      for (let i = 0; i < selected.length; i++) {
        const item       = selected[i];
        const media_url  = uploadedMedia?.url || item.image_url;
        const media_type = uploadedMedia?.media_type || "image";
        await storyApi.create({
          media_url,
          media_type,
          caption,
          hashtag,
          link_url:   linkUrl,
          link_image: linkImage,
          publish_at: scheduleAt || null,
        });
        setPubProgress({ done: i + 1, total: selected.length });
        if (i < selected.length - 1) await new Promise((r) => setTimeout(r, 6000));
      }
      router.replace("/feed");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setPublishing(false);
      setPubProgress(null);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // PICKER SCREEN
  // ──────────────────────────────────────────────────────────────
  if (screen === "picker") {
    // Grid data: camera slot + posts
    const gridData = mode === "upload"
      ? [{ id: "__camera" }, ...filteredPosts]
      : filteredPosts;

    return (
      <View style={s.root}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backBtnText}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Nueva Story</Text>
          {multiMode && selected.length > 0 ? (
            <TouchableOpacity
              style={s.nextBtn}
              onPress={() => goToEditor(selected)}
            >
              <Text style={s.nextBtnText}>Next ({selected.length}) →</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 80 }} />}
        </View>

        {/* Mode buttons */}
        <View style={s.modeRow}>
          {(["upload", "link", "post"] as Mode[]).map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => { setMode(m); resetPicker(); }}
              style={[s.modeBtn, mode === m && s.modeBtnActive]}
            >
              <Text style={s.modeBtnIcon}>
                {m === "upload" ? "📁" : m === "link" ? "🔗" : "🖼"}
              </Text>
              <Text style={[s.modeBtnLabel, mode === m && s.modeBtnLabelActive]}>
                {m === "upload" ? "File" : m === "link" ? "Link" : "Post"}
              </Text>
            </TouchableOpacity>
          ))}

          {mode === "upload" && (
            <TouchableOpacity
              style={s.galleryBtn}
              onPress={openGallery}
              disabled={publishing}
            >
              <Text style={s.galleryBtnText}>{publishing ? "..." : "Galería"}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* LINK MODE */}
        {mode === "link" && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.linkContainer}>
            <View style={s.linkInputRow}>
              <TextInput
                style={s.linkInput}
                placeholder="https://..."
                placeholderTextColor="#444"
                value={linkUrl}
                onChangeText={setLinkUrl}
                keyboardType="url"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[s.linkFetchBtn, (!linkUrl || fetchingLink) && s.btnDisabled]}
                onPress={doFetchLink}
                disabled={!linkUrl || fetchingLink}
              >
                <Text style={s.linkFetchBtnText}>{fetchingLink ? "..." : "Ver"}</Text>
              </TouchableOpacity>
            </View>

            {linkImage ? (
              <Image source={{ uri: linkImage }} style={s.linkPreviewImg} resizeMode="cover" />
            ) : null}

            <View style={s.hashInputRow}>
              <Text style={s.hashSign}>#</Text>
              <TextInput
                style={s.hashInput}
                placeholder="hashtag (sin #)"
                placeholderTextColor="#444"
                value={hashtag}
                onChangeText={(v) => setHashtag(v.replace(/\s/g, ""))}
                autoCapitalize="none"
              />
            </View>

            {linkUrl ? (
              <TouchableOpacity
                style={s.continueBtn}
                onPress={() => goToEditor([{ id: "__link", image_url: linkImage }])}
              >
                <Text style={s.continueBtnText}>Continuar →</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        )}

        {/* UPLOAD / POST MODE */}
        {mode !== "link" && (
          <>
            {/* Filter */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.filterRow}
            >
              {FILTER_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag.value}
                  onPress={() => setFilter(tag.value)}
                  style={[s.filterChip, filter === tag.value && s.filterChipActive]}
                >
                  <Text style={[s.filterChipText, filter === tag.value && s.filterChipTextActive]}>
                    {tag.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {loadingPosts ? (
              <ActivityIndicator color={RED} style={{ marginTop: 40 }} />
            ) : (
              <FlatList
                data={gridData}
                keyExtractor={(item) => String(item.id)}
                numColumns={3}
                contentContainerStyle={s.grid}
                columnWrapperStyle={s.gridRow}
                renderItem={({ item }) => {
                  // Camera slot
                  if (item.id === "__camera") {
                    return (
                      <TouchableOpacity style={s.gridItem} onPress={openCamera}>
                        <View style={s.cameraSlot}>
                          <Text style={s.cameraIcon}>📷</Text>
                          <Text style={s.cameraLabel}>Cámara</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }
                  const isSelected = selected.find((p) => p.id === item.id);
                  const selIdx     = selected.findIndex((p) => p.id === item.id);
                  return (
                    <Pressable
                      style={[s.gridItem, isSelected && s.gridItemSelected]}
                      onPress={() => onSelectPost(item)}
                      onLongPress={() => {
                        setMultiMode(true);
                        if (!selected.find((p) => p.id === item.id)) {
                          setSelected((prev) => [...prev, item]);
                        }
                      }}
                      delayLongPress={500}
                    >
                      <Image source={{ uri: item.image_url }} style={s.gridItemImg} />
                      {multiMode && isSelected && (
                        <View style={s.selBadge}>
                          <Text style={s.selBadgeText}>{selIdx + 1}</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                }}
                ListEmptyComponent={
                  <View style={s.emptyGrid}>
                    <Text style={s.emptyGridIcon}>🖼</Text>
                    <Text style={s.emptyGridText}>No hay posts con imágenes</Text>
                  </View>
                }
              />
            )}
          </>
        )}
      </View>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // EDITOR SCREEN
  // ──────────────────────────────────────────────────────────────
  const previewItem = selected[0];
  const previewUrl  = uploadedMedia?.url || previewItem?.image_url || "";

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => { setScreen("picker"); resetPicker(); }}
          style={s.backBtn}
        >
          <Text style={s.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Editar Story</Text>
        {selected.length > 1 ? (
          <Text style={s.multiLabel}>{selected.length} · 6s c/u</Text>
        ) : <View style={{ width: 80 }} />}
      </View>

      {/* Preview + tools */}
      <View style={s.editorPreviewRow}>
        <View style={s.editorMedia}>
          {previewUrl ? (
            <Image source={{ uri: previewUrl }} style={s.editorImage} resizeMode="contain" />
          ) : (
            <View style={s.editorNoMedia}>
              <Text style={s.editorNoMediaText}>Sin preview</Text>
            </View>
          )}
          {hashtag ? (
            <View style={s.hashOverlay}>
              <Text style={s.hashOverlayText}>#{hashtag}</Text>
            </View>
          ) : null}
        </View>

        {/* Tools column */}
        <View style={s.toolsCol}>
          {EDITOR_TOOLS.map((tool) => (
            <TouchableOpacity key={tool.label} style={s.toolBtn} disabled>
              <Text style={s.toolIcon}>{tool.icon}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Controls */}
      <View style={s.editorControls}>
        <TextInput
          style={s.captionInput}
          placeholder="Escribí un caption..."
          placeholderTextColor="#444"
          value={caption}
          onChangeText={setCaption}
          multiline
        />

        <View style={s.hashInputRow}>
          <Text style={s.hashSign}>#</Text>
          <TextInput
            style={s.hashInput}
            placeholder="hashtag (sin #)"
            placeholderTextColor="#444"
            value={hashtag}
            onChangeText={(v) => setHashtag(v.replace(/\s/g, ""))}
            autoCapitalize="none"
          />
        </View>

        {pubProgress ? (
          <Text style={s.progressText}>
            Publicando {pubProgress.done}/{pubProgress.total}... (6s entre stories)
          </Text>
        ) : null}

        <View style={s.publishRow}>
          <TouchableOpacity
            style={[s.publishBtn, publishing && s.btnDisabled]}
            onPress={() => publish()}
            disabled={publishing}
          >
            <Text style={s.publishBtnText}>{publishing ? "Publicando..." : "Add Story"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.setTimeBtn, publishing && s.btnDisabled]}
            onPress={() => setShowTimePicker(true)}
            disabled={publishing}
          >
            <Text style={s.setTimeBtnText}>Set Time</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Set Time modal */}
      <Modal visible={showTimePicker} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Programar publicación</Text>
            <Text style={s.modalHint}>Formato: YYYY-MM-DDTHH:MM</Text>
            <TextInput
              style={s.modalInput}
              placeholder="2025-12-31T20:00"
              placeholderTextColor="#444"
              value={publishAt}
              onChangeText={setPublishAt}
              autoCapitalize="none"
            />
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setShowTimePicker(false)}>
                <Text style={s.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalConfirmBtn, !publishAt && s.btnDisabled]}
                onPress={() => { setShowTimePicker(false); publish(publishAt || undefined); }}
                disabled={!publishAt}
              >
                <Text style={s.modalConfirmText}>Programar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const ITEM_SIZE = "31.5%" as any;

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: "#0D0D0D" },

  // Header
  header:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "#1A1A1A", borderBottomWidth: 1, borderBottomColor: "#2A2A2A" },
  backBtn:        { width: 36, height: 36, justifyContent: "center" },
  backBtnText:    { color: "#aaa", fontSize: 20 },
  headerTitle:    { color: "#fff", fontWeight: "900", fontSize: 16 },
  nextBtn:        { backgroundColor: RED, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  nextBtnText:    { color: "#fff", fontWeight: "700", fontSize: 12 },
  multiLabel:     { color: "#555", fontSize: 12, width: 80, textAlign: "right" },

  // Mode buttons (30×40px)
  modeRow:        { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingTop: 10 },
  modeBtn:        { width: 30, height: 40, borderRadius: 8, borderWidth: 1, borderColor: "#2A2A2A", backgroundColor: "#1A1A1A", alignItems: "center", justifyContent: "center" },
  modeBtnActive:  { backgroundColor: RED, borderColor: RED },
  modeBtnIcon:    { fontSize: 12 },
  modeBtnLabel:   { color: "#666", fontSize: 7, fontWeight: "900", textTransform: "uppercase" },
  modeBtnLabelActive: { color: "#fff" },
  galleryBtn:     { marginLeft: "auto" as any, borderWidth: 1, borderColor: "#2A2A2A", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  galleryBtnText: { color: "#aaa", fontSize: 12 },

  // Filter chips
  filterRow:      { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4, gap: 8 },
  filterChip:     { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "#2A2A2A", backgroundColor: "#1A1A1A" },
  filterChipActive: { backgroundColor: RED, borderColor: RED },
  filterChipText:   { color: "#666", fontSize: 12 },
  filterChipTextActive: { color: "#fff", fontWeight: "700" },

  // Grid
  grid:           { padding: 4, paddingBottom: 80 },
  gridRow:        { gap: 4, marginBottom: 4 },
  gridItem:       { width: ITEM_SIZE, aspectRatio: 1, borderRadius: 10, overflow: "hidden", borderWidth: 2, borderColor: "transparent" },
  gridItemSelected: { borderColor: RED },
  gridItemImg:    { width: "100%", height: "100%" },
  cameraSlot:     { flex: 1, backgroundColor: "#1A1A1A", alignItems: "center", justifyContent: "center", gap: 4 },
  cameraIcon:     { fontSize: 24 },
  cameraLabel:    { color: "#444", fontSize: 10 },
  selBadge:       { position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: RED, alignItems: "center", justifyContent: "center" },
  selBadgeText:   { color: "#fff", fontSize: 10, fontWeight: "900" },
  emptyGrid:      { alignItems: "center", paddingTop: 60 },
  emptyGridIcon:  { fontSize: 36, marginBottom: 8 },
  emptyGridText:  { color: "#444", fontSize: 13 },

  // Link mode
  linkContainer:  { padding: 16, gap: 12 },
  linkInputRow:   { flexDirection: "row", gap: 8 },
  linkInput:      { flex: 1, backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#2A2A2A", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: "#fff", fontSize: 13 },
  linkFetchBtn:   { backgroundColor: RED, borderRadius: 12, paddingHorizontal: 16, justifyContent: "center" },
  linkFetchBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  linkPreviewImg: { width: "100%", height: 180, borderRadius: 14 },
  hashInputRow:   { flexDirection: "row", alignItems: "center", backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#2A2A2A", borderRadius: 12, paddingHorizontal: 14 },
  hashSign:       { color: "#555", fontSize: 16, marginRight: 4 },
  hashInput:      { flex: 1, paddingVertical: 10, color: "#fff", fontSize: 13 },
  continueBtn:    { backgroundColor: RED, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  continueBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },

  // Editor
  editorPreviewRow: { flex: 1, flexDirection: "row", backgroundColor: "#000" },
  editorMedia:    { flex: 1, justifyContent: "center", alignItems: "center" },
  editorImage:    { width: "100%", height: "100%" },
  editorNoMedia:  { justifyContent: "center", alignItems: "center" },
  editorNoMediaText: { color: "#444" },
  hashOverlay:    { position: "absolute", bottom: 12, right: 12, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  hashOverlayText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  toolsCol:       { width: 48, paddingTop: 12, paddingRight: 4, gap: 10, alignItems: "center" },
  toolBtn:        { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(30,30,30,0.8)", borderWidth: 1, borderColor: "#2A2A2A", justifyContent: "center", alignItems: "center", opacity: 0.5 },
  toolIcon:       { color: "#fff", fontSize: 14 },

  // Editor controls
  editorControls: { backgroundColor: "#0D0D0D", borderTopWidth: 1, borderTopColor: "#1A1A1A", padding: 14, gap: 10 },
  captionInput:   { backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#2A2A2A", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: "#fff", fontSize: 13 },
  progressText:   { color: "#555", fontSize: 11, textAlign: "center" },
  publishRow:     { flexDirection: "row", gap: 10 },
  publishBtn:     { flex: 1, backgroundColor: RED, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  publishBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  setTimeBtn:     { flex: 1, borderWidth: 1, borderColor: "#2A2A2A", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  setTimeBtnText: { color: "#aaa", fontWeight: "700", fontSize: 15 },

  // Modal
  modalOverlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalSheet:     { backgroundColor: "#1A1A1A", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitle:     { color: "#fff", fontWeight: "900", fontSize: 18 },
  modalHint:      { color: "#555", fontSize: 12 },
  modalInput:     { backgroundColor: "#0D0D0D", borderWidth: 1, borderColor: "#2A2A2A", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: "#fff", fontSize: 14 },
  modalBtns:      { flexDirection: "row", gap: 10, marginTop: 4 },
  modalCancelBtn: { flex: 1, borderWidth: 1, borderColor: "#2A2A2A", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  modalCancelText: { color: "#aaa", fontWeight: "700" },
  modalConfirmBtn: { flex: 1, backgroundColor: RED, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  modalConfirmText: { color: "#fff", fontWeight: "900" },

  btnDisabled:    { opacity: 0.45 },
});
