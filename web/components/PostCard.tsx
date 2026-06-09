"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  factsApi, debatesApi, pinsApi, messagesApi, repostApi, profiles,
  reactionsApi, commentsApi, reportApi,
  type ReactionsOut, type CommentOut,
} from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";

interface Post {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string;
  caption: string;
  image_url: string;
  link_url: string;
  link_title: string;
  link_description: string;
  link_image: string;
  community_name?: string;
  created_at: string;
  user_id: number;
  is_pinned?: boolean;
  pin_count?: number;
  repost_of_id?: number;
  repost_of_username?: string;
  repost_of_display_name?: string;
  repost_count?: number;
}

const REACTIONS: { key: string; emoji: string; label: string }[] = [
  { key: "heart",  emoji: "❤️", label: "Like"   },
  { key: "fire",   emoji: "🔥", label: "Fire"   },
  { key: "cringe", emoji: "😬", label: "Cringe" },
  { key: "cope",   emoji: "😤", label: "Cope"   },
  { key: "based",  emoji: "👊", label: "Based"  },
  { key: "dead",   emoji: "💀", label: "Dead"   },
];

// ── Comment component ────────────────────────────────────────────────────────
function CommentItem({
  comment,
  currentUserId,
  onVote,
  onDelete,
  onReply,
  depth = 0,
}: {
  comment: CommentOut;
  currentUserId?: number;
  onVote: (id: number, vote: 1 | -1) => void;
  onDelete: (id: number) => void;
  onReply: (id: number, username: string) => void;
  depth?: number;
}) {
  const { t } = useLanguage();
  return (
    <div className={`${depth > 0 ? "ml-8 border-l border-gray-800 pl-3" : ""}`}>
      <div className="flex gap-2.5 py-2">
        <Link href={`/profile/${comment.username}`} className="flex-shrink-0">
          <div className="w-7 h-7 rounded-full bg-hate-light overflow-hidden flex items-center justify-center border border-gray-700">
            {comment.avatar_url
              ? <img src={comment.avatar_url} className="w-full h-full object-cover" alt="" />
              : <span className="text-hate-red font-black text-xs">{comment.display_name[0]}</span>
            }
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <Link href={`/profile/${comment.username}`} className="text-white font-bold text-xs hover:underline">
              {comment.display_name}
            </Link>
            <span className="text-gray-600 text-xs">@{comment.username}</span>
          </div>
          <p className="text-gray-300 text-sm mt-0.5 leading-relaxed">{comment.content}</p>
          <div className="flex items-center gap-3 mt-1.5">
            {/* Vote buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => onVote(comment.id, 1)}
                className={`text-xs font-bold px-1.5 py-0.5 rounded transition ${
                  comment.my_vote === 1 ? "text-green-400" : "text-gray-600 hover:text-green-400"
                }`}
              >
                ▲
              </button>
              <span className={`text-xs font-bold min-w-[1.5rem] text-center ${
                comment.score > 0 ? "text-green-400" : comment.score < 0 ? "text-hate-red" : "text-gray-600"
              }`}>
                {comment.score}
              </span>
              <button
                onClick={() => onVote(comment.id, -1)}
                className={`text-xs font-bold px-1.5 py-0.5 rounded transition ${
                  comment.my_vote === -1 ? "text-hate-red" : "text-gray-600 hover:text-hate-red"
                }`}
              >
                ▼
              </button>
            </div>
            {/* Reply */}
            {depth === 0 && (
              <button
                onClick={() => onReply(comment.id, comment.username)}
                className="text-xs text-gray-600 hover:text-gray-400 transition"
              >
                {t("reply")}
              </button>
            )}
            {/* Delete own */}
            {currentUserId === comment.user_id && (
              <button
                onClick={() => onDelete(comment.id)}
                className="text-xs text-gray-700 hover:text-hate-red transition"
              >
                {t("delete")}
              </button>
            )}
            <span className="text-gray-700 text-xs ml-auto">
              {new Date(comment.created_at).toLocaleDateString("es", { day: "2-digit", month: "short" })}
            </span>
          </div>
        </div>
      </div>

      {/* Nested replies */}
      {comment.replies.map((r) => (
        <CommentItem
          key={r.id}
          comment={r}
          currentUserId={currentUserId}
          onVote={onVote}
          onDelete={onDelete}
          onReply={onReply}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

// ── PostCard ─────────────────────────────────────────────────────────────────
export default function PostCard({ post, currentUserId }: { post: Post; currentUserId?: number }) {
  const { t } = useLanguage();

  // Truth/Fake
  const [facts, setFacts] = useState<any>(null);
  const [factsLoading, setFactsLoading] = useState(false);
  const [showFacts, setShowFacts] = useState(false);

  // Debate
  const [debate, setDebate] = useState<any>(undefined);
  const [debateLoading, setDebateLoading] = useState(false);
  const [showDebateMenu, setShowDebateMenu] = useState(false);

  // Save / Pin
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [pinned, setPinned] = useState(post.is_pinned ?? false);
  const [pinCount, setPinCount] = useState(post.pin_count ?? 0);

  // Share
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareStep, setShareStep] = useState<"menu" | "contacts">("menu");
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [shareMsg, setShareMsg] = useState("");
  const [sharing, setSharing] = useState(false);
  const [repostCount, setRepostCount] = useState(post.repost_count ?? 0);

  // Reactions
  const [reactions, setReactions] = useState<ReactionsOut | null>(null);

  // Comments
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentOut[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentSort, setCommentSort] = useState<"top" | "new">("top");
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: number; username: string } | null>(null);
  const [commentCount, setCommentCount] = useState(0);

  // Report
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDesc, setReportDesc] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  useEffect(() => {
    factsApi.get(post.id).then(setFacts).catch(() => {});
    debatesApi.get(post.id).then(setDebate).catch(() => setDebate(null));
    reactionsApi.get(post.id).then(setReactions).catch(() => {});
  }, [post.id]);

  useEffect(() => {
    if (showComments && !commentsLoaded) {
      commentsApi.get(post.id, commentSort).then((data) => {
        setComments(data);
        setCommentCount(countTotal(data));
        setCommentsLoaded(true);
      }).catch(() => {});
    }
  }, [showComments]);

  useEffect(() => {
    if (commentsLoaded) {
      commentsApi.get(post.id, commentSort).then((data) => {
        setComments(data);
        setCommentCount(countTotal(data));
      }).catch(() => {});
    }
  }, [commentSort]);

  useEffect(() => {
    if (shareStep === "contacts" && contacts.length === 0) {
      profiles.list().then(setContacts).catch(() => {});
    }
  }, [shareStep]);

  function countTotal(list: CommentOut[]): number {
    return list.reduce((acc, c) => acc + 1 + countTotal(c.replies), 0);
  }

  async function handleReaction(type: string) {
    try {
      const res = await reactionsApi.toggle(post.id, type);
      setReactions(res);
    } catch {}
  }

  async function handleVote(commentId: number, vote: 1 | -1) {
    try {
      const updated = await commentsApi.vote(commentId, vote);
      setComments((prev) => replaceComment(prev, updated));
    } catch {}
  }

  async function handleDeleteComment(commentId: number) {
    try {
      await commentsApi.delete(commentId);
      setComments((prev) => removeComment(prev, commentId));
      setCommentCount((n) => Math.max(0, n - 1));
    } catch {}
  }

  async function handleSubmitComment() {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const created = await commentsApi.create(post.id, newComment.trim(), replyTo?.id);
      if (replyTo) {
        setComments((prev) => addReply(prev, replyTo.id, created));
      } else {
        setComments((prev) => [created, ...prev]);
      }
      setCommentCount((n) => n + 1);
      setNewComment("");
      setReplyTo(null);
    } catch {} finally {
      setSubmitting(false);
    }
  }

  function replaceComment(list: CommentOut[], updated: CommentOut): CommentOut[] {
    return list.map((c) =>
      c.id === updated.id
        ? { ...updated, replies: c.replies }
        : { ...c, replies: replaceComment(c.replies, updated) }
    );
  }

  function removeComment(list: CommentOut[], id: number): CommentOut[] {
    return list
      .filter((c) => c.id !== id)
      .map((c) => ({ ...c, replies: removeComment(c.replies, id) }));
  }

  function addReply(list: CommentOut[], parentId: number, reply: CommentOut): CommentOut[] {
    return list.map((c) =>
      c.id === parentId
        ? { ...c, replies: [...c.replies, reply] }
        : { ...c, replies: addReply(c.replies, parentId, reply) }
    );
  }

  async function handleFactVote(vote: "truth" | "fake") {
    setFactsLoading(true);
    try { setFacts(await factsApi.vote(post.id, vote)); }
    finally { setFactsLoading(false); }
  }

  async function handleDebateVote(side: "for" | "against") {
    setDebateLoading(true);
    try { setDebate(await debatesApi.vote(post.id, side)); }
    finally { setDebateLoading(false); }
  }

  async function handleCreateDebate(hours: number) {
    setDebateLoading(true);
    setShowDebateMenu(false);
    try { setDebate(await debatesApi.create(post.id, hours)); }
    finally { setDebateLoading(false); }
  }

  async function handleSendToContacts() {
    if (!selectedUsers.length) return;
    setSharing(true);
    try {
      for (const username of selectedUsers) {
        await messagesApi.send(username, {
          content: shareMsg.trim() || "Te comparto este post 👇",
          shared_post_id: post.id,
        });
      }
      closeShareSheet();
    } catch {} finally { setSharing(false); }
  }

  async function handleRepost() {
    try {
      await repostApi.repost(post.id);
      setRepostCount((n) => n + 1);
      setShowShareSheet(false);
    } catch {}
  }

  function closeShareSheet() {
    setShowShareSheet(false);
    setShareStep("menu");
    setSelectedUsers([]);
    setShareMsg("");
  }

  const isMyPost = currentUserId === post.user_id;
  const debateIsActive = debate && debate.status === "active";
  const debateIsClosed = debate && debate.status === "closed";
  const postAgeHours = (Date.now() - new Date(post.created_at).getTime()) / 3600000;
  const canActivateDebate = isMyPost && !debate && postAgeHours < 24;

  function timeLeft(closesAt: string) {
    const diff = new Date(closesAt).getTime() - Date.now();
    if (diff <= 0) return t("debate_closed");
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  return (
    <div className="border-b border-gray-800 bg-hate-dark">

      {/* Label de Repost */}
      {post.repost_of_id && post.repost_of_username && (
        <div className="flex items-center gap-1.5 px-4 pt-2.5 pb-0">
          <span className="text-gray-500 text-xs">🔁 {t("share_reposted_from")}</span>
          <Link href={`/profile/${post.repost_of_username}`} className="text-gray-400 text-xs font-semibold hover:text-white transition">
            @{post.repost_of_username}
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Link href={`/profile/${post.username}`}>
          <div className="w-9 h-9 rounded-full bg-hate-light overflow-hidden flex-shrink-0 flex items-center justify-center border border-gray-700">
            {post.avatar_url
              ? <img src={post.avatar_url} alt={post.display_name} className="w-full h-full object-cover" />
              : <span className="text-hate-red font-black text-sm">{post.display_name[0]}</span>
            }
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/profile/${post.username}`} className="text-white font-bold text-sm hover:underline leading-none">
            {post.display_name}
          </Link>
          <p className="text-gray-600 text-xs">@{post.username}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {post.community_name && (
            <span className="text-xs text-gray-500 bg-hate-gray px-2 py-0.5 rounded-full border border-gray-700">
              {post.community_name}
            </span>
          )}
          <button
            onClick={() => setShowFacts((v) => !v)}
            className={`text-xs font-bold px-2.5 py-1 rounded-lg transition ${
              showFacts
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                : "text-gray-500 hover:text-blue-400 hover:bg-blue-500/10"
            }`}
          >
            🔍 {t("verify")}
          </button>

          {/* Report button + panel */}
          <div className="relative">
            <button
              onClick={() => { setShowReport((v) => !v); setReportDone(false); setReportReason(""); setReportDesc(""); }}
              className="text-xs font-bold px-2.5 py-1 rounded-lg transition text-gray-500 hover:text-hate-red hover:bg-hate-red/10"
            >
              🚩 {t("report")}
            </button>
            {showReport && (
              <div className="absolute right-0 top-8 bg-[#1A1A1A] border border-gray-700 rounded-2xl p-4 z-30 w-64 shadow-2xl">
                {reportDone ? (
                  <p className="text-green-400 text-sm text-center py-2 font-semibold">{t("report_sent")}</p>
                ) : (
                  <>
                    <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold mb-3">{t("report_title")}</p>
                    <div className="flex flex-col gap-1 mb-3">
                      {[
                        { key: "spam",                  label: t("reason_spam") },
                        { key: "acoso",                 label: t("reason_acoso") },
                        { key: "contenido_inapropiado", label: t("reason_contenido_inapropiado") },
                        { key: "discurso_de_odio",      label: t("reason_discurso_de_odio") },
                        { key: "desinformacion",        label: t("reason_desinformacion") },
                        { key: "violencia",             label: t("reason_violencia") },
                        { key: "otro",                  label: t("reason_otro") },
                      ].map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => setReportReason(key)}
                          className={`text-left text-sm px-3 py-2 rounded-xl transition ${
                            reportReason === key
                              ? "bg-hate-red/20 text-hate-red border border-hate-red/40"
                              : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={reportDesc}
                      onChange={(e) => setReportDesc(e.target.value)}
                      placeholder={t("report_desc_placeholder")}
                      rows={2}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-300 placeholder-gray-600 resize-none mb-3 focus:outline-none focus:border-gray-600"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowReport(false)}
                        className="flex-1 text-xs text-gray-500 hover:text-gray-300 py-2 rounded-xl hover:bg-gray-800 transition"
                      >
                        {t("cancel")}
                      </button>
                      <button
                        disabled={!reportReason || reportSending}
                        onClick={async () => {
                          if (!reportReason) return;
                          setReportSending(true);
                          try {
                            await reportApi.create({ reason: reportReason, description: reportDesc, reported_post_id: post.id });
                            setReportDone(true);
                            setTimeout(() => setShowReport(false), 1500);
                          } catch {}
                          setReportSending(false);
                        }}
                        className="flex-1 text-xs font-bold py-2 rounded-xl bg-hate-red/20 text-hate-red border border-hate-red/40 hover:bg-hate-red/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {reportSending ? "..." : t("report_send")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          {canActivateDebate && (
            <div className="relative">
              <button
                onClick={() => setShowDebateMenu((v) => !v)}
                className="text-xs text-gray-500 hover:text-hate-red transition px-2 py-1 rounded-lg hover:bg-hate-gray"
              >
                ⚡ {t("debate")}
              </button>
              {showDebateMenu && (
                <div className="absolute right-0 top-7 bg-hate-gray border border-gray-700 rounded-xl p-3 z-20 w-44 shadow-xl">
                  <p className="text-gray-400 text-xs mb-2 font-semibold">{t("debate_duration")}</p>
                  {[24, 48, 72].map((h) => (
                    <button key={h} onClick={() => handleCreateDebate(h)}
                      className="w-full text-left text-sm text-gray-300 hover:text-hate-red py-1.5 px-2 rounded-lg hover:bg-hate-light transition">
                      {h} {t("debate_hours")}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {debateIsActive && (
            <span className="flex items-center gap-1 text-xs text-green-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Debate
            </span>
          )}
        </div>
      </div>

      {/* Truth/Fake */}
      {showFacts && (
        <div className="mx-4 mb-2 rounded-2xl overflow-hidden border border-blue-500/20 bg-hate-gray/50">
          {post.link_url ? (
            <div className="px-4 py-2.5 border-b border-gray-800/50">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">{t("fact_source")}</p>
              <a href={post.link_url} target="_blank" rel="noopener noreferrer"
                className="text-blue-400 text-xs hover:underline break-all">{post.link_url}</a>
            </div>
          ) : (
            <div className="px-4 py-2.5 border-b border-gray-800/50">
              <p className="text-gray-500 text-xs">{t("fact_no_source")}</p>
            </div>
          )}
          <div className="flex">
            <button onClick={() => handleFactVote("truth")} disabled={factsLoading}
              className={`flex-1 py-2.5 text-xs font-black tracking-widest uppercase transition ${facts?.my_vote === "truth" ? "bg-green-500 text-white" : "bg-transparent text-gray-400 hover:bg-green-500/20 hover:text-green-400"}`}>
              ✅ {t("fact_truth")} {facts?.total > 0 && `${facts.truth_pct}%`}
            </button>
            <div className="w-px bg-gray-800" />
            <button onClick={() => handleFactVote("fake")} disabled={factsLoading}
              className={`flex-1 py-2.5 text-xs font-black tracking-widest uppercase transition ${facts?.my_vote === "fake" ? "bg-hate-red text-white" : "bg-transparent text-gray-400 hover:bg-hate-red/20 hover:text-hate-red"}`}>
              ❌ {t("fact_fake")} {facts?.total > 0 && `${facts.fake_pct}%`}
            </button>
          </div>
          {facts?.total > 0 && (
            <div className="flex h-1">
              <div className="bg-green-500 transition-all" style={{ width: `${facts.truth_pct}%` }} />
              <div className="bg-hate-red transition-all" style={{ width: `${facts.fake_pct}%` }} />
            </div>
          )}
        </div>
      )}

      {/* Imagen */}
      {post.image_url && (
        <img src={post.image_url} alt={post.caption} className="w-full object-cover" style={{ maxHeight: 400 }} />
      )}

      {/* Link preview */}
      {post.link_url && (
        <a href={post.link_url} target="_blank" rel="noopener noreferrer"
          className="block mx-4 mb-1 rounded-xl overflow-hidden border border-gray-700 hover:border-hate-red transition">
          {post.link_image && <img src={post.link_image} alt="" className="w-full object-cover" style={{ maxHeight: 180 }} />}
          <div className="p-3 bg-hate-gray">
            <p className="text-gray-500 text-xs uppercase tracking-wide">{new URL(post.link_url).hostname}</p>
            {post.link_title && <p className="text-white text-sm font-bold mt-0.5 leading-snug">{post.link_title}</p>}
            {post.link_description && <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">{post.link_description}</p>}
          </div>
        </a>
      )}

      {/* ── Reaction bar ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-4 py-2 border-t border-gray-800/50">
        {REACTIONS.map(({ key, emoji, label }) => {
          const count = reactions?.counts?.[key as keyof typeof reactions.counts] ?? 0;
          const active = reactions?.my_reaction === key;
          return (
            <button
              key={key}
              onClick={() => handleReaction(key)}
              title={label}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-sm transition ${
                active
                  ? "bg-hate-red/20 border border-hate-red/40 text-white"
                  : "text-gray-500 hover:bg-hate-gray hover:text-gray-200 border border-transparent"
              }`}
            >
              <span>{emoji}</span>
              {count > 0 && <span className={`text-xs font-bold ${active ? "text-hate-red" : "text-gray-500"}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* ── Action row (share, comment, save) ────────────────────── */}
      <div className="flex justify-around px-1 py-1 border-t border-gray-800/30">
        {/* Share */}
        <button
          onClick={() => { setShowShareSheet(true); setShareStep("menu"); }}
          className="flex items-center justify-center p-2 transition hover:opacity-70"
        >
          <img src="/icons/icono compartir.png" alt="Share" className="w-8 h-8 object-contain" />
        </button>

        {/* Comment */}
        <button
          onClick={() => setShowComments((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition ${showComments ? "text-blue-400" : "text-gray-500 hover:text-gray-300"}`}
        >
          <img src="/icons/Letra S.png" alt="Comment" className="w-6 h-6 object-contain opacity-70" />
          {commentCount > 0 && <span className="text-xs font-bold">{commentCount}</span>}
        </button>

        {/* Save / Pin */}
        <button
          onClick={() => setShowSaveSheet(true)}
          className="flex items-center justify-center p-2 transition hover:opacity-70"
        >
          <img src="/icons/fav icon.png" alt="Favorite" className="w-8 h-8 object-contain" />
        </button>
      </div>

      {/* Caption */}
      <div className="px-4 pt-0 pb-3">
        {post.caption && (
          <p className="text-gray-200 text-sm leading-relaxed">
            <span className="font-bold text-white mr-1">{post.display_name}</span>
            {post.caption}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <p className="text-gray-700 text-xs">
            {new Date(post.created_at).toLocaleDateString("es", { day: "2-digit", month: "short" })}
          </p>
          {pinCount > 0 && <span className="text-gray-600 text-xs">📌 {pinCount}</span>}
          {repostCount > 0 && <span className="text-gray-600 text-xs">🔁 {repostCount}</span>}
        </div>
      </div>

      {/* Debate */}
      {debate && (
        <div className="mx-4 mb-4 rounded-2xl border border-gray-700 overflow-hidden">
          <div className={`px-4 py-2.5 flex items-center justify-between ${debateIsClosed ? "bg-gray-800/50" : "bg-hate-gray"}`}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${debateIsActive ? "bg-green-400 animate-pulse" : "bg-gray-600"}`} />
              <span className="text-white font-black text-xs tracking-widest uppercase">
                {debateIsClosed ? t("debate_closed") : t("debate_active")}
              </span>
            </div>
            {debateIsActive && <span className="text-gray-400 text-xs">{timeLeft(debate.closes_at)}</span>}
          </div>
          {debateIsClosed && debate.winner && (
            <div className={`px-4 py-2 text-center text-sm font-black ${
              debate.winner === "for" ? "text-green-400" :
              debate.winner === "against" ? "text-hate-red" : "text-gray-400"
            }`}>
              {debate.winner === "for" ? t("debate_won_for") :
               debate.winner === "against" ? t("debate_won_against") : t("debate_draw")}
            </div>
          )}
          <div className="flex">
            <button onClick={() => debateIsActive && handleDebateVote("for")}
              disabled={debateLoading || debateIsClosed}
              className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition ${debate.my_vote === "for" ? "bg-green-500/20 text-green-400" : debateIsActive ? "hover:bg-green-500/10 text-gray-400 hover:text-green-400" : "text-gray-600"}`}>
              <span className="font-black text-sm">{t("debate_for")}</span>
              <span className="text-xs">{debate.for_count} {debate.total > 0 && `· ${debate.for_pct}%`}</span>
            </button>
            <div className="w-px bg-gray-700" />
            <button onClick={() => debateIsActive && handleDebateVote("against")}
              disabled={debateLoading || debateIsClosed}
              className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition ${debate.my_vote === "against" ? "bg-hate-red/20 text-hate-red" : debateIsActive ? "hover:bg-hate-red/10 text-gray-400 hover:text-hate-red" : "text-gray-600"}`}>
              <span className="font-black text-sm">{t("debate_against")}</span>
              <span className="text-xs">{debate.against_count} {debate.total > 0 && `· ${debate.against_pct}%`}</span>
            </button>
          </div>
          {debate.total > 0 && (
            <div className="flex h-1">
              <div className="bg-green-500 transition-all" style={{ width: `${debate.for_pct}%` }} />
              <div className="bg-hate-red transition-all" style={{ width: `${debate.against_pct}%` }} />
            </div>
          )}
        </div>
      )}

      {/* ── Comments section ──────────────────────────────────────── */}
      {showComments && (
        <div className="border-t border-gray-800 bg-hate-dark">
          {/* Sort toggle */}
          <div className="flex items-center gap-2 px-4 pt-3 pb-1">
            <span className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Comentarios</span>
            <div className="flex ml-auto bg-hate-gray rounded-lg overflow-hidden border border-gray-700">
              {(["top", "new"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setCommentSort(s)}
                  className={`px-3 py-1 text-xs font-bold transition ${
                    commentSort === s ? "bg-hate-light text-white" : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {s === "top" ? t("sort_top") : t("sort_new")}
                </button>
              ))}
            </div>
          </div>

          {/* New comment input */}
          <div className="px-4 py-2">
            {replyTo && (
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-gray-500 text-xs">{t("replying_to")} @{replyTo.username}</span>
                <button onClick={() => setReplyTo(null)} className="text-gray-600 hover:text-gray-400 text-xs">✕</button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmitComment()}
                placeholder={replyTo ? `${t("reply")} @${replyTo.username}...` : t("add_comment")}
                className="flex-1 bg-hate-gray border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-hate-red placeholder-gray-600"
              />
              <button
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || submitting}
                className="bg-hate-red hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition disabled:opacity-40"
              >
                {submitting ? "..." : "→"}
              </button>
            </div>
          </div>

          {/* Comment list */}
          <div className="px-4 pb-3 divide-y divide-gray-800/30">
            {comments.length === 0 && commentsLoaded && (
              <p className="text-gray-600 text-xs text-center py-4">{t("no_comments")}</p>
            )}
            {comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                currentUserId={currentUserId}
                onVote={handleVote}
                onDelete={handleDeleteComment}
                onReply={(id, username) => setReplyTo({ id, username })}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Share Bottom Sheet ── */}
      {showShareSheet && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeShareSheet} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-hate-gray border-t border-gray-700 rounded-t-2xl max-w-[430px] mx-auto" style={{ maxHeight: "80vh" }}>
            <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mt-3 mb-2" />

            {shareStep === "menu" ? (
              <div className="p-4 space-y-2">
                <p className="text-gray-500 text-xs uppercase tracking-wider font-semibold px-1 mb-3">{t("share")}</p>
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-hate-light transition text-left">
                  <span className="text-2xl">📸</span>
                  <div>
                    <p className="text-white font-semibold text-sm">{t("share_to_story")}</p>
                    <p className="text-gray-500 text-xs">{t("share_coming_soon")}</p>
                  </div>
                </button>
                <button
                  onClick={() => setShareStep("contacts")}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-hate-light transition text-left"
                >
                  <span className="text-2xl">✉️</span>
                  <div>
                    <p className="text-white font-semibold text-sm">{t("share_as_message")}</p>
                    <p className="text-gray-500 text-xs">{t("share_msg_hint")}</p>
                  </div>
                </button>
                <button
                  onClick={handleRepost}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-hate-light transition text-left"
                >
                  <span className="text-2xl">🔁</span>
                  <div>
                    <p className="text-white font-semibold text-sm">{t("repost")}</p>
                    <p className="text-gray-500 text-xs">{t("share_repost_hint")}</p>
                  </div>
                </button>
              </div>
            ) : (
              <div className="flex flex-col" style={{ maxHeight: "75vh" }}>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 flex-shrink-0">
                  <button onClick={() => setShareStep("menu")} className="text-gray-400 hover:text-white text-sm">←</button>
                  <p className="text-white font-bold text-sm flex-1">{t("send_dm")}...</p>
                  <button
                    onClick={handleSendToContacts}
                    disabled={!selectedUsers.length || sharing}
                    className="text-xs bg-hate-red hover:bg-red-700 text-white font-bold px-4 py-1.5 rounded-xl transition disabled:opacity-40"
                  >
                    {sharing ? "..." : `${t("share_send")}${selectedUsers.length > 0 ? ` (${selectedUsers.length})` : ""}`}
                  </button>
                </div>
                <div className="px-4 py-2 border-b border-gray-800 flex-shrink-0">
                  <input
                    value={shareMsg}
                    onChange={(e) => setShareMsg(e.target.value)}
                    placeholder={t("share_add_msg")}
                    className="w-full bg-hate-light border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-hate-red placeholder-gray-600"
                  />
                </div>
                <div className="overflow-y-auto flex-1 divide-y divide-gray-800/50">
                  {contacts
                    .filter((c) => c.username !== post.username)
                    .map((c) => {
                      const selected = selectedUsers.includes(c.username);
                      return (
                        <button
                          key={c.username}
                          onClick={() => setSelectedUsers((prev) =>
                            selected ? prev.filter((u) => u !== c.username) : [...prev, c.username]
                          )}
                          className={`w-full flex items-center gap-3 px-4 py-3 transition text-left ${selected ? "bg-hate-red/10" : "hover:bg-hate-gray"}`}
                        >
                          <div className="w-9 h-9 rounded-full bg-hate-light overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {c.avatar_url
                              ? <img src={c.avatar_url} className="w-full h-full object-cover" alt="" />
                              : <span className="text-hate-red font-black text-sm">{c.display_name[0]}</span>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-semibold truncate">{c.display_name}</p>
                            <p className="text-gray-500 text-xs">@{c.username}</p>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${selected ? "bg-hate-red border-hate-red" : "border-gray-600"}`}>
                            {selected && <span className="text-white text-xs">✓</span>}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Save Bottom Sheet ── */}
      {showSaveSheet && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowSaveSheet(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-hate-gray border-t border-gray-700 rounded-t-2xl p-4 space-y-2 max-w-[430px] mx-auto">
            <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-3" />
            <button
              onClick={() => setShowSaveSheet(false)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-hate-light transition text-left"
            >
              <span className="text-xl">⭐</span>
              <div>
                <p className="text-white font-semibold text-sm">Guardar en Favoritos</p>
                <p className="text-gray-500 text-xs">{t("save_coming_soon")}</p>
              </div>
            </button>
            <button
              onClick={async () => {
                const res = await pinsApi.toggle(post.id);
                setPinned(res.pinned);
                setPinCount(res.pin_count);
                setShowSaveSheet(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-hate-light transition text-left ${pinned ? "bg-blue-500/10" : ""}`}
            >
              <span className="text-xl">📌</span>
              <div>
                <p className={`font-semibold text-sm ${pinned ? "text-blue-400" : "text-white"}`}>
                  {pinned ? t("pin_remove") : t("pin_add")}
                </p>
                <p className="text-gray-500 text-xs">{t("pin_hint")}</p>
              </div>
            </button>
          </div>
        </>
      )}

    </div>
  );
}
