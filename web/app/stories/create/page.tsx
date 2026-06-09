"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { postApi, storyApi, uploadMedia, fetchLinkPreview } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";

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

export default function CreateStoryPage() {
  const router = useRouter();
  const { t } = useLanguage();

  // ── Screens & mode ────────────────────────────────────────────
  const [screen, setScreen]   = useState<Screen>("picker");
  const [mode, setMode]       = useState<Mode>("upload");
  const [filter, setFilter]   = useState("");

  // ── Posts (picker grid) ───────────────────────────────────────
  const [myPosts, setMyPosts] = useState<any[]>([]);

  // ── Selection ─────────────────────────────────────────────────
  const [selected, setSelected]     = useState<any[]>([]);
  const [multiMode, setMultiMode]   = useState(false);
  const longPressTimer              = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Uploaded media (from file / camera) ───────────────────────
  const [uploadedMedia, setUploadedMedia] = useState<{ url: string; media_type: "image" | "video" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Camera ────────────────────────────────────────────────────
  const [showCamera, setShowCamera] = useState(false);
  const [camStream, setCamStream]   = useState<MediaStream | null>(null);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
  const [publishAt, setPublishAt]           = useState("");

  // ── Load posts ────────────────────────────────────────────────
  useEffect(() => {
    postApi.mineWithMedia().then(setMyPosts).catch(console.error);
  }, []);

  // ── Sync camera stream to video element ───────────────────────
  useEffect(() => {
    if (showCamera && videoRef.current && camStream) {
      videoRef.current.srcObject = camStream;
    }
  }, [showCamera, camStream]);

  // ── Filter posts ──────────────────────────────────────────────
  const filteredPosts = filter
    ? myPosts.filter((p) => p.community_slug === filter)
    : myPosts;

  // ──────────────────────────────────────────────────────────────
  // Handlers
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

  // Long press ← enables multi-select
  function onPressStart(post: any) {
    longPressTimer.current = setTimeout(() => {
      setMultiMode(true);
      setSelected([post]);
    }, 500);
  }
  function onPressEnd() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }

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

  // File upload
  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPublishing(true);
    try {
      const result = await uploadMedia(file);
      setUploadedMedia(result);
      goToEditor([{ id: "__upload", image_url: result.url, media_type: result.media_type }]);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPublishing(false);
      e.target.value = "";
    }
  }

  // Camera
  async function openCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setCamStream(s);
      setShowCamera(true);
    } catch {
      alert("No se pudo acceder a la cámara");
    }
  }

  function closeCamera() {
    camStream?.getTracks().forEach((track) => track.stop());
    setCamStream(null);
    setShowCamera(false);
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width  = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    c.toBlob(async (blob) => {
      if (!blob) return;
      closeCamera();
      setPublishing(true);
      try {
        const file   = new File([blob], "capture.jpg", { type: "image/jpeg" });
        const result = await uploadMedia(file);
        setUploadedMedia(result);
        goToEditor([{ id: "__camera", image_url: result.url, media_type: "image" }]);
      } catch (err: any) {
        alert(err.message);
      } finally {
        setPublishing(false);
      }
    }, "image/jpeg", 0.92);
  }

  // Link preview fetch
  async function fetchLink() {
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

  // Publish
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
        router.push("/feed");
        return;
      }

      setPubProgress({ done: 0, total: selected.length });
      for (let i = 0; i < selected.length; i++) {
        const item       = selected[i];
        const media_url  = uploadedMedia?.url  || item.image_url;
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
      router.push("/feed");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPublishing(false);
      setPubProgress(null);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // PICKER SCREEN
  // ──────────────────────────────────────────────────────────────
  if (screen === "picker") {
    return (
      <div className="min-h-screen bg-hate-dark flex flex-col items-center">
        <div className="w-full max-w-[430px] flex flex-col h-screen">

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 flex-shrink-0">
            <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition text-lg">←</button>
            <span className="font-black text-white flex-1">{t("story_new")}</span>
            {multiMode && selected.length > 0 && (
              <button
                onClick={() => goToEditor(selected)}
                className="bg-hate-red text-white text-xs font-bold px-4 py-1.5 rounded-xl"
              >
                {t("story_next")}
              </button>
            )}
          </div>

          {/* Mode buttons */}
          <div className="flex gap-2 px-4 pt-3 flex-shrink-0">
            {(["upload", "link", "post"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); resetPicker(); }}
                style={{ width: 30, height: 40 }}
                className={`rounded-lg text-[9px] font-black uppercase flex flex-col items-center justify-center transition border ${
                  mode === m
                    ? "bg-hate-red border-hate-red text-white"
                    : "bg-hate-gray border-gray-700 text-gray-400 hover:border-gray-500"
                }`}
              >
                {m === "upload" && <><span className="text-sm">📁</span><span>File</span></>}
                {m === "link"   && <><span className="text-sm">🔗</span><span>Link</span></>}
                {m === "post"   && <><span className="text-sm">🖼</span><span>Post</span></>}
              </button>
            ))}

            {/* Upload file trigger */}
            {mode === "upload" && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={publishing}
                className="ml-auto text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg px-3 py-1 transition disabled:opacity-50"
              >
                {publishing ? t("uploading") : t("story_upload")}
              </button>
            )}
          </div>

          {/* ── LINK MODE ── */}
          {mode === "link" && (
            <div className="flex-1 px-4 pt-4 flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="flex-1 bg-hate-gray border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-hate-red"
                />
                <button
                  onClick={fetchLink}
                  disabled={fetchingLink || !linkUrl}
                  className="bg-hate-red text-white text-xs font-bold px-3 rounded-xl disabled:opacity-50"
                >
                  {fetchingLink ? "..." : t("story_link_preview")}
                </button>
              </div>

              {linkImage && (
                <div className="relative rounded-2xl overflow-hidden aspect-video">
                  <img src={linkImage} alt="" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="flex items-center gap-2 bg-hate-gray border border-gray-700 rounded-xl px-3 py-2">
                <span className="text-gray-400 text-sm">#</span>
                <input
                  type="text"
                  placeholder={t("story_hashtag")}
                  value={hashtag}
                  onChange={(e) => setHashtag(e.target.value.replace(/\s/g, ""))}
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none"
                />
              </div>

              {linkUrl && (
                <button
                  onClick={() => goToEditor([{ id: "__link", image_url: linkImage }])}
                  className="w-full bg-hate-red text-white font-bold py-3 rounded-2xl mt-auto"
                >
                  {t("story_continue")}
                </button>
              )}
            </div>
          )}

          {/* ── UPLOAD / POST MODE: filter + grid ── */}
          {mode !== "link" && (
            <>
              <div className="px-4 pt-3 flex-shrink-0">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full bg-hate-gray border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-hate-red"
                >
                  {FILTER_TAGS.map((tag) => (
                    <option key={tag.value} value={tag.value}>{tag.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4">
                <div className="grid grid-cols-3 gap-1">

                  {/* Slot 0: cámara */}
                  {mode === "upload" && (
                    <button
                      onClick={openCamera}
                      className="aspect-square rounded-xl bg-hate-gray border border-gray-700 flex flex-col items-center justify-center gap-1 hover:border-hate-red transition"
                    >
                      <span className="text-2xl">📷</span>
                      <span className="text-[10px] text-gray-500">{t("story_camera")}</span>
                    </button>
                  )}

                  {filteredPosts.map((post) => {
                    const isSelected = selected.find((p) => p.id === post.id);
                    const selIdx     = selected.findIndex((p) => p.id === post.id);
                    return (
                      <button
                        key={post.id}
                        className={`relative aspect-square rounded-xl overflow-hidden border-2 transition ${
                          isSelected ? "border-hate-red" : "border-transparent"
                        }`}
                        onClick={() => onSelectPost(post)}
                        onMouseDown={() => onPressStart(post)}
                        onMouseUp={onPressEnd}
                        onTouchStart={() => onPressStart(post)}
                        onTouchEnd={onPressEnd}
                      >
                        <img src={post.image_url} alt="" className="w-full h-full object-cover" />
                        {multiMode && isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-hate-red flex items-center justify-center text-white text-[10px] font-bold">
                            {selIdx + 1}
                          </div>
                        )}
                      </button>
                    );
                  })}

                  {filteredPosts.length === 0 && (
                    <div className="col-span-3 py-16 flex flex-col items-center text-gray-700">
                      <p className="text-3xl mb-2">🖼</p>
                      <p className="text-sm">{t("story_no_images")}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Next button for multi-select (bottom right) */}
              {multiMode && selected.length > 0 && (
                <div className="fixed flex justify-end px-4 pb-6" style={{ bottom: 0, right: "max(0px, calc(50% - 215px))", width: 430 }}>
                  <button
                    onClick={() => goToEditor(selected)}
                    className="bg-hate-red text-white font-bold px-6 py-3 rounded-2xl shadow-xl"
                  >
                    {t("story_next")} ({selected.length})
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Camera modal */}
        {showCamera && (
          <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center">
            <video ref={videoRef} autoPlay playsInline className="w-full max-w-[430px] rounded-2xl" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex gap-4 mt-6">
              <button onClick={closeCamera} className="text-gray-400 hover:text-white px-6 py-3 rounded-2xl border border-gray-700 transition">
                {t("cancel")}
              </button>
              <button onClick={capturePhoto} className="bg-white w-16 h-16 rounded-full border-4 border-hate-red shadow-xl" />
            </div>
          </div>
        )}

        {/* File input oculto */}
        <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={onFileSelected} />
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // EDITOR SCREEN
  // ──────────────────────────────────────────────────────────────
  const previewItem  = selected[0];
  const previewUrl   = uploadedMedia?.url || previewItem?.image_url || "";
  const isVideo      = uploadedMedia?.media_type === "video" || previewItem?.media_type === "video";

  return (
    <div className="min-h-screen bg-black flex flex-col items-center">
      <div className="w-full max-w-[430px] flex flex-col h-screen">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-hate-dark border-b border-gray-800 flex-shrink-0">
          <button
            onClick={() => { setScreen("picker"); resetPicker(); }}
            className="text-gray-400 hover:text-white transition text-lg"
          >
            ←
          </button>
          <span className="font-black text-white flex-1">{t("story_edit")}</span>
          {selected.length > 1 && (
            <span className="text-gray-500 text-xs">{selected.length} {t("story_images_count")}</span>
          )}
        </div>

        {/* Preview + tools */}
        <div className="flex flex-1 min-h-0">
          {/* Media preview */}
          <div className="flex-1 flex items-center justify-center bg-black relative">
            {previewUrl ? (
              isVideo ? (
                <video src={previewUrl} controls autoPlay className="max-h-full max-w-full object-contain" />
              ) : (
                <img src={previewUrl} alt="" className="max-h-full max-w-full object-contain" />
              )
            ) : (
              <div className="text-gray-700 text-sm">{t("story_no_preview")}</div>
            )}

            {/* Hashtag overlay preview */}
            {hashtag && (
              <div className="absolute bottom-4 right-4 bg-black/60 rounded-lg px-2 py-1">
                <span className="text-white text-xs font-bold">#{hashtag}</span>
              </div>
            )}
          </div>

          {/* Tools column */}
          <div className="flex flex-col gap-3 px-2 pt-4 flex-shrink-0">
            {EDITOR_TOOLS.map((tool) => (
              <button
                key={tool.label}
                title={tool.label}
                className="w-9 h-9 rounded-xl bg-hate-gray/80 border border-gray-700 text-white text-sm flex items-center justify-center hover:border-hate-red transition opacity-50 cursor-not-allowed"
              >
                {tool.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="bg-hate-dark border-t border-gray-800 px-4 pt-3 pb-5 flex-shrink-0 space-y-3">
          <input
            type="text"
            placeholder={t("story_caption")}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full bg-hate-gray border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-hate-red"
          />

          <div className="flex items-center gap-2 bg-hate-gray border border-gray-700 rounded-xl px-3 py-2">
            <span className="text-gray-400 text-sm">#</span>
            <input
              type="text"
              placeholder={t("story_hashtag")}
              value={hashtag}
              onChange={(e) => setHashtag(e.target.value.replace(/\s/g, ""))}
              className="flex-1 bg-transparent text-white text-sm focus:outline-none"
            />
          </div>

          {/* Progress indicator */}
          {pubProgress && (
            <p className="text-center text-gray-400 text-xs">
              {t("story_publishing")} {pubProgress.done}/{pubProgress.total}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => publish()}
              disabled={publishing}
              className="flex-1 bg-hate-red hover:bg-red-700 text-white font-bold py-3 rounded-2xl transition disabled:opacity-50"
            >
              {publishing ? t("story_publishing") : t("story_add")}
            </button>
            <button
              onClick={() => setShowTimePicker(true)}
              disabled={publishing}
              className="flex-1 border border-gray-700 text-gray-300 hover:border-hate-red hover:text-white font-bold py-3 rounded-2xl transition disabled:opacity-50"
            >
              {t("story_set_time")}
            </button>
          </div>
        </div>
      </div>

      {/* Set Time modal */}
      {showTimePicker && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center">
          <div className="w-full max-w-[430px] bg-hate-gray rounded-t-3xl px-6 pt-5 pb-8 space-y-4">
            <p className="font-black text-white text-lg">{t("story_schedule_title")}</p>
            <input
              type="datetime-local"
              value={publishAt}
              onChange={(e) => setPublishAt(e.target.value)}
              className="w-full bg-hate-dark border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-hate-red"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowTimePicker(false)}
                className="flex-1 border border-gray-700 text-gray-400 py-3 rounded-2xl"
              >
                {t("cancel")}
              </button>
              <button
                onClick={() => { setShowTimePicker(false); publish(publishAt || undefined); }}
                disabled={!publishAt}
                className="flex-1 bg-hate-red text-white font-bold py-3 rounded-2xl disabled:opacity-50"
              >
                {t("story_schedule_btn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
