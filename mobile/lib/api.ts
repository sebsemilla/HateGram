import * as SecureStore from "expo-secure-store";

const API_URL = "http://localhost:8000";

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await SecureStore.getItemAsync("token");
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Error desconocido" }));
    throw new Error(err.detail || "Error en la solicitud");
  }
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────
export const auth = {
  register: (data: { username: string; email: string; password: string }) =>
    apiFetch("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { username: string; password: string }) =>
    apiFetch("/auth/login", { method: "POST", body: JSON.stringify(data) }),
};

// ── Profiles ──────────────────────────────────────────────────────
export const profiles = {
  me: () => apiFetch("/profiles/me"),
  get: (username: string) => apiFetch(`/profiles/${username}`),
  list: () => apiFetch("/profiles/"),
  update: (data: object) =>
    apiFetch("/profiles/me", { method: "PATCH", body: JSON.stringify(data) }),
};

// ── Posts ─────────────────────────────────────────────────────────
export const postApi = {
  feed: () => apiFetch("/posts/feed"),
  byUser: (username: string) => apiFetch(`/posts/user/${username}`),
  create: (data: object) => apiFetch("/posts/", { method: "POST", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch(`/posts/${id}`, { method: "DELETE" }),
  mineWithMedia: () => apiFetch("/posts/mine/with-media"),
};

// ── Communities ───────────────────────────────────────────────────
export const communityApi = {
  list: (type?: string, search?: string) => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (search) params.set("search", search);
    return apiFetch(`/communities/?${params}`);
  },
  get: (slug: string) => apiFetch(`/communities/${slug}`),
  join: (slug: string) => apiFetch(`/communities/${slug}/join`, { method: "POST" }),
  leave: (slug: string) => apiFetch(`/communities/${slug}/leave`, { method: "DELETE" }),
  feed: (slug: string, sort = "new", view = "all") =>
    apiFetch(`/communities/${slug}/feed?sort=${sort}&view=${view}`),
};

// ── Upload ────────────────────────────────────────────────────────

/** Sube una imagen (para posts, avatares, etc.). Devuelve la URL absoluta. */
export async function uploadImage(uri: string, mimeType = "image/jpeg"): Promise<string> {
  const token = await SecureStore.getItemAsync("token");
  const formData = new FormData();
  formData.append("file", { uri, name: "upload.jpg", type: mimeType } as any);

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

/** Sube imagen o video para stories. Devuelve url + media_type. */
export async function uploadMedia(
  uri: string,
  mimeType: string,
): Promise<{ url: string; media_type: "image" | "video" }> {
  const token = await SecureStore.getItemAsync("token");
  const ext = uri.split(".").pop() ?? "bin";
  const formData = new FormData();
  formData.append("file", { uri, name: `media.${ext}`, type: mimeType } as any);

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

// ── Stories ───────────────────────────────────────────────────────

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

// ── Link preview ──────────────────────────────────────────────────
export async function fetchLinkPreview(url: string) {
  return apiFetch(`/preview/link?url=${encodeURIComponent(url)}`);
}

// ── Follow ────────────────────────────────────────────────────────
export const followApi = {
  toggle: (username: string) => apiFetch(`/follow/${username}`, { method: "POST" }),
  status: (username: string) => apiFetch(`/follow/status/${username}`),
};

// ── Reactions ─────────────────────────────────────────────────────
export type ReactionCounts = { heart: number; fire: number; cringe: number; cope: number; based: number; dead: number };
export type ReactionsOut = { counts: ReactionCounts; my_reaction: string | null; total: number };

export const reactionsApi = {
  get: (postId: number): Promise<ReactionsOut> => apiFetch(`/posts/${postId}/reactions`),
  toggle: (postId: number, reaction_type: string): Promise<ReactionsOut> =>
    apiFetch(`/posts/${postId}/reactions`, { method: "POST", body: JSON.stringify({ reaction_type }) }),
};

// ── Comments ──────────────────────────────────────────────────────
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

export const searchApi = {
  search: (q: string, type: "users" | "posts" | "all" = "all") =>
    apiFetch(`/search/?q=${encodeURIComponent(q)}&type=${type}`),
  follow: (username: string) => apiFetch(`/follow/${username}`, { method: "POST" }),
};
