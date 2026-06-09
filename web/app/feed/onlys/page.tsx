"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { communityApi } from "@/lib/api";

export default function OnlysFeedPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const u = localStorage.getItem("user");
    if (u) setUser(JSON.parse(u));
    communityApi.list("fan").then(setGroups).catch(console.error);
  }, []);

  useEffect(() => {
    communityApi.list("fan", search || undefined).then(setGroups).catch(console.error);
  }, [search]);

  return (
    <div className="min-h-screen bg-hate-dark flex flex-col items-center">
      <nav className="w-full max-w-[430px] bg-hate-gray border-b border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/feed" className="text-gray-400 hover:text-white text-sm">←</Link>
        <span className="text-xl font-black text-hate-red">Onlys</span>
      </nav>

      <div className="w-full max-w-[430px] px-3 py-4">
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Buscar grupos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-hate-gray border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-hate-red"
          />
          {user?.is_verified && (
            <Link href="/communities/create"
              className="bg-hate-red hover:bg-red-700 text-white text-sm font-bold px-4 rounded-xl transition flex items-center">
              +
            </Link>
          )}
        </div>

        {groups.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <p className="text-4xl mb-3">⭐</p>
            <p className="text-sm">No hay grupos fan todavía.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {groups.map((c) => (
              <Link key={c.slug} href={`/communities/${c.slug}`}
                className="relative rounded-2xl overflow-hidden aspect-[3/4] group">
                <div className="absolute inset-0 bg-hate-gray group-hover:bg-hate-light transition" />
                {c.image_url && <img src={c.image_url} alt={c.name} className="absolute inset-0 w-full h-full object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-hate-red transition" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-white font-black text-sm">{c.name}</p>
                  <p className="text-gray-400 text-xs">{c.member_count} miembros</p>
                  {c.is_member && <span className="text-xs text-hate-red font-bold">● Miembro</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
