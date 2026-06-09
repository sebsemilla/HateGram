"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { communityApi } from "@/lib/api";
import CreatePostModal from "@/components/CreatePostModal";
import { useLanguage } from "@/hooks/useLanguage";

export default function CommunityPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const [community, setCommunity] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [joining, setJoining] = useState(false);
  const [showPost, setShowPost] = useState(false);

  useEffect(() => {
    const u = localStorage.getItem("user");
    if (u) setUser(JSON.parse(u));
    communityApi.get(slug).then(setCommunity).catch(() => router.replace("/feed"));
    communityApi.feed(slug).then(setPosts).catch(console.error);
  }, [slug, router]);

  async function handleJoinLeave() {
    if (!community) return;
    setJoining(true);
    try {
      if (community.is_member) {
        await communityApi.leave(slug);
        setCommunity((c: any) => ({ ...c, is_member: false, member_count: c.member_count - 1 }));
      } else {
        await communityApi.join(slug);
        setCommunity((c: any) => ({ ...c, is_member: true, member_count: c.member_count + 1 }));
      }
    } finally {
      setJoining(false);
    }
  }

  if (!community) return (
    <div className="min-h-screen flex items-center justify-center text-gray-500">{t("loading")}</div>
  );

  return (
    <div className="min-h-screen bg-hate-dark">
      <nav className="bg-hate-gray border-b border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <Link href="/feed" className="text-gray-400 hover:text-white text-sm">{t("back_feed")}</Link>
        <span className="text-xl font-black text-hate-red">HateGram</span>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-hate-gray rounded-xl overflow-hidden mb-5">
          {community.image_url && (
            <img src={community.image_url} alt={community.name} className="w-full h-36 object-cover" />
          )}
          <div className="p-5 flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-black text-white">{community.name}</h1>
                {community.type === "fan" && (
                  <span className="text-xs bg-hate-red/20 text-hate-red px-2 py-0.5 rounded-full">{t("community_fan_badge")}</span>
                )}
              </div>
              <p className="text-gray-500 text-sm mt-0.5">{community.member_count} {t("members")}</p>
              {community.description && <p className="text-gray-400 text-sm mt-2">{community.description}</p>}
            </div>
            {user && (
              <button
                onClick={handleJoinLeave}
                disabled={joining}
                className={`text-sm font-bold px-5 py-2 rounded-xl transition disabled:opacity-50 flex-shrink-0 ${
                  community.is_member
                    ? "border border-gray-600 text-gray-400 hover:text-hate-red hover:border-hate-red"
                    : "bg-hate-red hover:bg-red-700 text-white"
                }`}
              >
                {joining ? "..." : community.is_member ? t("community_leave") : t("community_join")}
              </button>
            )}
          </div>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm">
              {community.is_member ? t("community_no_posts_mine") : t("community_no_posts_join")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div key={post.id} className="bg-hate-gray rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <Link href={`/profile/${post.username}`}>
                    <div className="w-9 h-9 rounded-full bg-hate-light overflow-hidden flex items-center justify-center">
                      {post.avatar_url
                        ? <img src={post.avatar_url} alt={post.display_name} className="w-full h-full object-cover" />
                        : <span className="text-hate-red font-black text-sm">{post.display_name[0]}</span>
                      }
                    </div>
                  </Link>
                  <div>
                    <Link href={`/profile/${post.username}`} className="text-white font-semibold text-sm hover:underline">{post.display_name}</Link>
                    <p className="text-gray-600 text-xs">@{post.username}</p>
                  </div>
                </div>
                {post.image_url && <img src={post.image_url} alt="" className="w-full object-cover max-h-96" />}
                {post.link_url && (
                  <a href={post.link_url} target="_blank" rel="noopener noreferrer"
                    className="block mx-4 mb-3 rounded-xl overflow-hidden border border-gray-700 hover:border-hate-red transition">
                    {post.link_image && <img src={post.link_image} alt="" className="w-full h-40 object-cover" />}
                    <div className="p-3 bg-hate-light">
                      <p className="text-gray-500 text-xs">{new URL(post.link_url).hostname}</p>
                      {post.link_title && <p className="text-white text-sm font-bold mt-0.5">{post.link_title}</p>}
                    </div>
                  </a>
                )}
                {post.caption && <p className="px-4 pb-4 text-gray-300 text-sm">{post.caption}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {community.is_member && (
        <button
          onClick={() => setShowPost(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-hate-red hover:bg-red-700 rounded-full shadow-lg flex items-center justify-center text-white text-3xl transition z-20"
        >
          +
        </button>
      )}

      {showPost && (
        <CreatePostModal
          communityId={community.id}
          onClose={() => setShowPost(false)}
          onCreated={() => communityApi.feed(slug).then(setPosts).catch(console.error)}
        />
      )}
    </div>
  );
}
