"use client";
import { useRef, useState } from "react";
import { uploadImage, postApi, fetchLinkPreview } from "@/lib/api";

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

  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setImageUrl(url);
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
      const data = await fetchLinkPreview(linkInput.trim());
      setPreview(data);
    } catch (err: any) {
      setPreviewError("No se pudo obtener la vista previa del link");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const payload: Record<string, string> = { caption };

    if (tab === "photo") {
      if (!imageUrl && !caption.trim()) {
        setError("Agregá una foto o escribí algo");
        return;
      }
      payload.image_url = imageUrl;
    } else {
      if (!preview) {
        setError("Pegá un link y cargá la vista previa primero");
        return;
      }
      payload.link_url = preview.url;
      payload.link_title = preview.title;
      payload.link_description = preview.description;
      payload.link_image = preview.image;
    }

    if (communityId) payload.community_id = String(communityId);
    if (debateEnabled) (payload as any).debate_hours = debateHours;

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

        {/* Tabs */}
        <div className="flex border-b border-gray-800 flex-shrink-0">
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
        </div>

        <div className="p-5 space-y-4 flex-1">
          {/* Tab: Foto */}
          {tab === "photo" && (
            <>
              {/* Área de imagen */}
              <div
                onClick={() => fileRef.current?.click()}
                className={`relative w-full aspect-square rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden transition
                  ${imageUrl ? "border-transparent" : "border-gray-700 hover:border-hate-red bg-hate-light"}`}
              >
                {imageUrl ? (
                  <>
                    <img src={imageUrl} alt="preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition flex items-center justify-center">
                      <span className="text-white text-sm font-semibold">Cambiar foto</span>
                    </div>
                  </>
                ) : uploading ? (
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-hate-red border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Subiendo...</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-4xl mb-2">📷</p>
                    <p className="text-gray-400 text-sm">Tocá para elegir una foto</p>
                    <p className="text-gray-600 text-xs mt-1">JPG, PNG, WEBP — máx 5 MB</p>
                  </div>
                )}
              </div>
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

              {/* Vista previa del link — estilo Facebook */}
              {preview && (
                <div className="rounded-xl overflow-hidden border border-gray-700 bg-hate-light">
                  {preview.image && (
                    <img src={preview.image} alt={preview.title} className="w-full h-48 object-cover" />
                  )}
                  <div className="p-3">
                    <p className="text-gray-500 text-xs uppercase mb-1">
                      {new URL(preview.url).hostname}
                    </p>
                    {preview.title && (
                      <p className="text-white font-bold text-sm leading-snug mb-1">{preview.title}</p>
                    )}
                    {preview.description && (
                      <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">{preview.description}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Caption (ambos tabs) */}
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
              {/* Toggle pill */}
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
                        debateHours === h
                          ? "bg-hate-red text-white"
                          : "bg-hate-light text-gray-400 hover:text-white"
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
