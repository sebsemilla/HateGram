const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401 && typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
    return {} as any;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Error desconocido" }));
    const detail = Array.isArray(err.detail)
      ? err.detail.map((e: any) => e.msg).join(", ")
      : err.detail || "Error en la solicitud";
    throw new Error(detail);
  }
  return res.json();
}

export const auth = {
  register: (data: { username: string; email: string; password: string }) =>
    apiFetch("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { username: string; password: string }) =>
    apiFetch("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  forgotPassword: (email: string) =>
    apiFetch("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (token: string, new_password: string) =>
    apiFetch("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, new_password }) }),
  logout: () =>
    apiFetch("/auth/logout", { method: "POST" }).catch(() => {}),
  resendVerification: () =>
    apiFetch("/auth/resend-verification", { method: "POST" }),
};

export const searchApi = {
  search: (q: string, type: "users" | "posts" | "all" = "all") =>
    apiFetch(`/search/?q=${encodeURIComponent(q)}&type=${type}`),
};

export const notifApi = {
  list: () => apiFetch("/notifications/"),
  unreadCount: () => apiFetch("/notifications/unread-count"),
  markAllRead: () => apiFetch("/notifications/read-all", { method: "PATCH" }),
  markRead: (id: number) => apiFetch(`/notifications/${id}/read`, { method: "PATCH" }),
};

export async function logout() {
  await auth.logout();
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("_prev_token");
    localStorage.removeItem("lang");
    window.location.href = "/login";
  }
}

export async function uploadImage(file: File): Promise<string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}/upload/image`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Error al subir imagen" }));
    throw new Error(err.detail || "Error al subir imagen");
  }
  const data = await res.json();
  return `${API_URL}${data.url}`;
}

export const factsApi = {
  get: (postId: number) => apiFetch(`/facts/${postId}`),
  vote: (postId: number, vote: "truth" | "fake") =>
    apiFetch(`/facts/${postId}`, { method: "POST", body: JSON.stringify({ vote }) }),
};

export const debatesApi = {
  get: (postId: number) => apiFetch(`/debates/${postId}`),
  create: (postId: number, duration_hours: number) =>
    apiFetch(`/debates/${postId}`, { method: "POST", body: JSON.stringify({ duration_hours }) }),
  vote: (postId: number, side: "for" | "against") =>
    apiFetch(`/debates/${postId}/vote`, { method: "POST", body: JSON.stringify({ side }) }),
};

export const communityApi = {
  list: (type?: string, search?: string) => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (search) params.set("search", search);
    return apiFetch(`/communities/?${params}`);
  },
  get: (slug: string) => apiFetch(`/communities/${slug}`),
  create: (data: object) => apiFetch("/communities/", { method: "POST", body: JSON.stringify(data) }),
  join: (slug: string) => apiFetch(`/communities/${slug}/join`, { method: "POST" }),
  leave: (slug: string) => apiFetch(`/communities/${slug}/leave`, { method: "DELETE" }),
  feed: (slug: string, sort = "new", view = "all") =>
    apiFetch(`/communities/${slug}/feed?sort=${sort}&view=${view}`),
};

export const adminApi = {
  stats: () => apiFetch("/admin/stats"),
  reports: (status?: string) => apiFetch(`/admin/reports${status ? `?status=${status}` : ""}`),
  updateReport: (id: number, status: string) =>
    apiFetch(`/admin/reports/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  users: () => apiFetch("/admin/users"),
  toggleUser: (id: number) => apiFetch(`/admin/users/${id}/toggle-active`, { method: "PATCH" }),
  impersonate: (id: number) => apiFetch(`/admin/impersonate/${id}`, { method: "POST" }),
};

export const reportApi = {
  create: (data: object) => apiFetch("/reports/", { method: "POST", body: JSON.stringify(data) }),
};

export const botApi = {
  list: () => apiFetch("/bots/"),
  create: (data: object) => apiFetch("/bots/", { method: "POST", body: JSON.stringify(data) }),
  createBatch: (data: object) => apiFetch("/bots/batch", { method: "POST", body: JSON.stringify(data) }),
  toggle: (id: number) => apiFetch(`/bots/${id}/toggle`, { method: "PATCH" }),
  delete: (id: number) => apiFetch(`/bots/${id}`, { method: "DELETE" }),
  updateProfile: (id: number, data: object) =>
    apiFetch(`/bots/${id}/profile`, { method: "PATCH", body: JSON.stringify(data) }),
  addAction: (botId: number, data: object) =>
    apiFetch(`/bots/${botId}/actions`, { method: "POST", body: JSON.stringify(data) }),
  updateAction: (botId: number, actionId: number, data: object) =>
    apiFetch(`/bots/${botId}/actions/${actionId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteAction: (botId: number, actionId: number) =>
    apiFetch(`/bots/${botId}/actions/${actionId}`, { method: "DELETE" }),
  updateApiKeys: (data: object) =>
    apiFetch("/admin/api-keys", { method: "PATCH", body: JSON.stringify(data) }),
  update: (id: number, data: object) =>
    apiFetch(`/bots/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  run: (id: number) =>
    apiFetch(`/bots/${id}/run`, { method: "POST" }),
};

export const postApi = {
  create: (data: object) => apiFetch("/posts/", { method: "POST", body: JSON.stringify(data) }),
  byUser: (username: string) => apiFetch(`/posts/user/${username}`),
  feed: () => apiFetch("/posts/feed"),
  delete: (id: number) => apiFetch(`/posts/${id}`, { method: "DELETE" }),
  mineWithMedia: () => apiFetch("/posts/mine/with-media"),
};

export const pinsApi = {
  toggle: (postId: number) => apiFetch(`/pins/${postId}`, { method: "POST" }),
  mine: () => apiFetch("/pins/"),
  byUser: (username: string) => apiFetch(`/pins/user/${username}`),
};

export const followApi = {
  toggle: (username: string) => apiFetch(`/follow/${username}`, { method: "POST" }),
  status: (username: string) => apiFetch(`/follow/status/${username}`),
};

export const messagesApi = {
  conversations: () => apiFetch("/messages/"),
  thread: (username: string) => apiFetch(`/messages/${username}`),
  send: (username: string, data: { content: string; shared_post_id?: number }) =>
    apiFetch(`/messages/${username}`, { method: "POST", body: JSON.stringify(data) }),
};

export const repostApi = {
  repost: (postId: number) =>
    apiFetch("/posts/", { method: "POST", body: JSON.stringify({ repost_of_id: postId }) }),
};

export type ReactionCounts = {
  heart: number; fire: number; cringe: number; cope: number; based: number; dead: number;
};
export type ReactionsOut = { counts: ReactionCounts; my_reaction: string | null; total: number };

export const reactionsApi = {
  get: (postId: number): Promise<ReactionsOut> => apiFetch(`/posts/${postId}/reactions`),
  toggle: (postId: number, reaction_type: string): Promise<ReactionsOut> =>
    apiFetch(`/posts/${postId}/reactions`, { method: "POST", body: JSON.stringify({ reaction_type }) }),
};

export type CommentOut = {
  id: number;
  post_id: number;
  user_id: number;
  username: string;
  display_name: string;
  avatar_url: string;
  content: string;
  created_at: string;
  parent_id: number | null;
  score: number;
  my_vote: number | null;
  replies: CommentOut[];
};

export const commentsApi = {
  get: (postId: number, sort: "top" | "new" = "top"): Promise<CommentOut[]> =>
    apiFetch(`/comments/${postId}?sort=${sort}`),
  create: (postId: number, content: string, parent_id?: number): Promise<CommentOut> =>
    apiFetch(`/comments/${postId}`, { method: "POST", body: JSON.stringify({ content, parent_id }) }),
  delete: (commentId: number) => apiFetch(`/comments/${commentId}`, { method: "DELETE" }),
  vote: (commentId: number, vote: 1 | -1): Promise<CommentOut> =>
    apiFetch(`/comments/${commentId}/vote`, { method: "POST", body: JSON.stringify({ vote }) }),
};

export async function fetchLinkPreview(url: string) {
  return apiFetch(`/preview/link?url=${encodeURIComponent(url)}`);
}

export const profiles = {
  me: () => apiFetch("/profiles/me"),
  get: (username: string) => apiFetch(`/profiles/${username}`),
  list: () => apiFetch("/profiles/"),
  update: (data: object) =>
    apiFetch("/profiles/me", { method: "PATCH", body: JSON.stringify(data) }),
};

export async function uploadMedia(file: File): Promise<{ url: string; media_type: "image" | "video" }> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}/upload/media`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Error al subir archivo" }));
    throw new Error(err.detail || "Error al subir archivo");
  }
  const data = await res.json();
  return { url: `${API_URL}${data.url}`, media_type: data.media_type };
}

export type StoryItem = {
  id: number;
  media_url: string;
  media_type: "image" | "video";
  caption: string;
  hashtag: string;
  link_url: string;
  link_image: string;
  created_at: string;
  publish_at: string | null;
};

export type StoryGroup = {
  user_id: number;
  username: string;
  avatar_url: string;
  stories: StoryItem[];
  latest_at: string;
};

export type StoryCreateData = {
  media_url: string;
  media_type: string;
  caption?: string;
  hashtag?: string;
  link_url?: string;
  link_image?: string;
  publish_at?: string | null;
};

export const storyApi = {
  feed: (): Promise<StoryGroup[]> => apiFetch("/stories/feed"),
  create: (data: StoryCreateData) =>
    apiFetch("/stories/", { method: "POST", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch(`/stories/${id}`, { method: "DELETE" }),
};
