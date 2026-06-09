"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { communityApi, uploadImage } from "@/lib/api";

export default function CreateCommunityPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", slug: "", description: "", image_url: "" });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function autoSlug(name: string) {
    return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 60);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setForm((f) => ({ ...f, image_url: url }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.slug.trim()) { setError("Nombre y slug son obligatorios"); return; }
    setSaving(true);
    setError("");
    try {
      const community = await communityApi.create(form);
      router.push(`/communities/${community.slug}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-hate-dark">
      <nav className="bg-hate-gray border-b border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <Link href="/feed" className="text-gray-400 hover:text-white text-sm">← Feed</Link>
        <span className="text-xl font-black text-hate-red">HateGram</span>
      </nav>

      <div className="max-w-md mx-auto px-4 py-8">
        <h1 className="text-2xl font-black text-white mb-6">Crear grupo fan</h1>

        <form onSubmit={handleSubmit} className="bg-hate-gray rounded-xl p-6 space-y-4">
          {/* Imagen */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Imagen del grupo</label>
            <div className="relative h-32 bg-hate-light rounded-xl overflow-hidden flex items-center justify-center cursor-pointer"
              onClick={() => document.getElementById("img-input")?.click()}>
              {form.image_url
                ? <img src={form.image_url} alt="" className="w-full h-full object-cover" />
                : <div className="text-center">
                    <p className="text-3xl mb-1">🖼️</p>
                    <p className="text-gray-500 text-xs">{uploading ? "Subiendo..." : "Elegir imagen"}</p>
                  </div>
              }
            </div>
            <input id="img-input" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Nombre del grupo</label>
            <input
              type="text" required maxLength={100}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value, slug: autoSlug(e.target.value) })}
              className="w-full bg-hate-light border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-hate-red"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Slug (URL)</label>
            <div className="flex items-center bg-hate-light border border-gray-700 rounded-lg overflow-hidden">
              <span className="px-3 text-gray-600 text-sm">/communities/</span>
              <input
                type="text" required maxLength={60}
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: autoSlug(e.target.value) })}
                className="flex-1 bg-transparent py-2 pr-4 text-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Descripción</label>
            <textarea
              rows={3} maxLength={500}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full bg-hate-light border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-hate-red resize-none"
            />
          </div>

          {error && <p className="text-hate-red text-sm">{error}</p>}

          <button type="submit" disabled={saving || uploading}
            className="w-full bg-hate-red hover:bg-red-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-50">
            {saving ? "Creando..." : "Crear grupo"}
          </button>
        </form>
      </div>
    </div>
  );
}
