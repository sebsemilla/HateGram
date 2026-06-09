"use client";
import { useRef, useState, useEffect } from "react";
import { uploadImage, postApi, fetchLinkPreview, communityApi } from "@/lib/api";

interface LinkPreview {
  url: string;
  title: string;
  description: string;
  image: string;
}

interface Props {
  onClose: () => void;
  onCreated: () => void;
  communityId?: number;
}

type Tab = "photo" | "link";

export default function CreatePostModal({ onClose, onCreated, communityId }: Props) {
  const [tab, setTab] = useState<Tab>("photo");
  const [caption, setCaption] = useState("");

  // Foto
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  // Link
  const [linkInput, setLinkInput] = useState("");
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState("");

  // Debate
  const [debateEnabled, setDebateEnabled] = useState(false);
  const [debateHours, setDebateHours] = useState(24);

  // Feed selector
  const [communities, setCommunities] = useState<any[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState<number | null>(null);

  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!communityId) {
      communityApi.list().then(setCommunities).catch(() => {});
    }
  }, [communityId]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      setImageUrl(await uploadImage(file));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleFetchPreview() {
    if (!linkInput.trim()) return;
    setLoadingPreview(true);
    setPreviewError("");
    setPreview(null);
    try {
      setPreview(await fetchLinkPreview(linkInput.trim()));
    } catch {
      setPreviewError("No se pudo obtener la vista previa del link");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (tab === "photo") {
      if (!imageUrl && !caption.trim()) {
        setError("Agregá una foto o escribí algo");
        return;
      }
    } else {
      if (!preview) {
        setError("Pegá un link y cargá la vista previa primero");
        return;
      }
    }

    const payload: any = { caption };
    if (tab === "photo") payload.image_url = imageUrl;
    if (tab === "link" && preview) {
      payload.link_url = preview.url;
      payload.link_title = preview.title;
      payload.link_description = preview.description;
      payload.link_image = preview.image;
    }

    const resolvedCommunityId = communityId ?? selectedCommunityId ?? null;
    if (resolvedCommunityId) payload.community_id = resolvedCommunityId;
    if (debateEnabled) payload.debate_hours = debateHours;

    setPosting(true);
    try {
      await postApi.create(payload);
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/75 z-30 flex items-end sm:items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-hate-gray rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
          <h2 className="font-black text-white text-lg">Nuevo post</h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        {/* Tabs + Feed selector */}
        <div className="flex items-stretch border-b border-gray-800 flex-shrink-0">
          {(["photo", "link"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-semibold transition ${
                tab === t ? "text-hate-red border-b-2 border-hate-red" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {t === "photo" ? "📷 Foto" : "🔗 Link"}
            </button>
          ))}

          {/* Feed selector — only when not scoped to a community */}
          {!communityId && (
            <>
              <div className="w-px bg-gray-800 my-2" />
              <select
                value={selectedCommunityId ?? ""}
                onChange={(e) => setSelectedCommunityId(e.target.value ? Number(e.target.value) : null)}
                className="flex-1 bg-transparent text-gray-400 text-xs px-3 focus:outline-none hover:text-white cursor-pointer text-center"
              >
                <option value="">🌐 Main</option>
                {communities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </>
          )}
        </div>

        <div className="p-5 space-y-4 flex-1">
          {/* Tab: Foto */}
          {tab === "photo" && (
            <>
              {imageUrl ? (
                /* Compact image preview */
                <div className="relative h-32 rounded-xl overflow-hidden border border-gray-700">
                  <img src={imageUrl} alt="preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setImageUrl(""); fileRef.current && (fileRef.current.value = ""); }}
                    className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white text-xs font-bold px-2 py-1 rounded-lg transition"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileRef.current?.click()}
                  className="relative h-32 w-full rounded-xl border-2 border-dashed border-gray-700 hover:border-hate-red bg-hate-light flex items-center justify-center cursor-pointer transition"
                >
                  {uploading ? (
                    <div className="text-center">
                      <div className="w-6 h-6 border-2 border-hate-red border-t-transparent rounded-full animate-spin mx-auto mb-1" />
                      <p className="text-gray-500 text-xs">Subiendo...</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📷</span>
                      <div>
                        <p className="text-gray-400 text-sm">Elegí una foto</p>
                        <p className="text-gray-600 text-xs">JPG, PNG, WEBP — máx 5 MB</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </>
          )}

          {/* Tab: Link */}
          {tab === "link" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://..."
                  value={linkInput}
                  onChange={(e) => { setLinkInput(e.target.value); setPreview(null); setPreviewError(""); }}
                  className="flex-1 bg-hate-light border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-hate-red"
                />
                <button
                  type="button"
                  onClick={handleFetchPreview}
                  disabled={!linkInput.trim() || loadingPreview}
                  className="bg-hate-red hover:bg-red-700 text-white text-sm font-semibold px-4 rounded-lg transition disabled:opacity-40"
                >
                  {loadingPreview ? "..." : "Cargar"}
                </button>
              </div>

              {previewError && <p className="text-hate-red text-sm">{previewError}</p>}

              {preview && (
                <div className="rounded-xl overflow-hidden border border-gray-700 bg-hate-light">
                  {preview.image && (
                    <img src={preview.image} alt={preview.title} className="w-full h-48 object-cover" />
                  )}
                  <div className="p-3">
                    <p className="text-gray-500 text-xs uppercase mb-1">{new URL(preview.url).hostname}</p>
                    {preview.title && <p className="text-white font-bold text-sm leading-snug mb-1">{preview.title}</p>}
                    {preview.description && (
                      <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">{preview.description}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Caption */}
          <div>
            <textarea
              rows={3}
              placeholder="Escribí algo..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full bg-hate-light border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-hate-red resize-none placeholder-gray-600"
            />
          </div>

          {/* Toggle Debate */}
          <div className={`rounded-xl border transition ${debateEnabled ? "border-hate-red/50 bg-hate-red/5" : "border-gray-700"}`}>
            <button
              type="button"
              onClick={() => setDebateEnabled((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-lg">⚡</span>
                <div className="text-left">
                  <p className={`text-sm font-bold ${debateEnabled ? "text-hate-red" : "text-gray-300"}`}>Activar Debate</p>
                  <p className="text-xs text-gray-500">Los usuarios votan A Favor / En Contra</p>
                </div>
              </div>
              <div className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 flex items-center px-0.5 ${debateEnabled ? "bg-hate-red" : "bg-gray-700"}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${debateEnabled ? "translate-x-4" : "translate-x-0"}`} />
              </div>
            </button>

            {debateEnabled && (
              <div className="px-4 pb-3 flex items-center gap-2">
                <p className="text-xs text-gray-400 flex-shrink-0">Duración:</p>
                <div className="flex gap-2">
                  {[24, 48, 72].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setDebateHours(h)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${
                        debateHours === h ? "bg-hate-red text-white" : "bg-hate-light text-gray-400 hover:text-white"
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-hate-red text-sm">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex-shrink-0">
          <button
            type="submit"
            disabled={posting}
            className="w-full bg-hate-red hover:bg-red-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-50"
          >
            {posting ? "Publicando..." : "Publicar"}
          </button>
        </div>
      </form>
    </div>
  );
}
