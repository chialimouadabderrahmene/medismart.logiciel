// Cloud AI client - talks to the Vercel-hosted credits/OpenRouter proxy
// Configuration is stored in localStorage so the doctor can set it from Settings.

const STORAGE_KEY = "medismart-cloud-ai-v1";
const TOKEN_KEY = "medismart-cloud-ai-token";

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  // Fallback to build-time env var
  const fromEnv = (import.meta.env.VITE_AI_CLOUD_URL || "").trim();
  return { url: fromEnv, doctor_id: "", secret: "" };
}

export function getCloudConfig() {
  return loadConfig();
}

export function saveCloudConfig({ url, doctor_id, secret }) {
  const cfg = { url: (url || "").trim(), doctor_id: (doctor_id || "").trim(), secret: (secret || "").trim() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  // New credentials => clear old token
  localStorage.removeItem(TOKEN_KEY);
  return cfg;
}

export function isCloudConfigured() {
  const c = loadConfig();
  return Boolean(c.url && c.doctor_id && c.secret);
}

async function getToken() {
  const cached = localStorage.getItem(TOKEN_KEY);
  if (cached) return cached;
  const cfg = loadConfig();
  if (!cfg.url || !cfg.doctor_id || !cfg.secret) {
    throw new Error("Configuration cloud IA manquante. Renseignez l'URL, Doctor ID et Secret dans Paramètres.");
  }
  const res = await fetch(cfg.url.replace(/\/$/, "") + "/api/auth/doctor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doctor_id: cfg.doctor_id, secret: cfg.secret }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Authentification cloud IA échouée");
  localStorage.setItem(TOKEN_KEY, data.token);
  return data.token;
}

async function cloudFetch(path, options = {}) {
  const cfg = loadConfig();
  if (!cfg.url) throw new Error("URL cloud IA non configurée");
  const token = await getToken();
  const url = cfg.url.replace(/\/$/, "") + path;
  let res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Doctor-Token": token,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    // Token expired -> retry once
    localStorage.removeItem(TOKEN_KEY);
    const newToken = await getToken();
    res = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", "X-Doctor-Token": newToken, ...(options.headers || {}) },
    });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Cloud IA erreur ${res.status}`);
  return data;
}

export const cloudAi = {
  test: async () => {
    const cfg = loadConfig();
    if (!cfg.url) throw new Error("URL non configurée");
    const r = await fetch(cfg.url.replace(/\/$/, "") + "/api/health");
    return await r.json();
  },
  subscription: () => cloudFetch("/api/me/subscription"),
  logs: () => cloudFetch("/api/me/logs"),
  chat: (messageOrMessages, action_type = "chat", max_tokens = 256) => {
    const body = Array.isArray(messageOrMessages)
      ? { messages: messageOrMessages, action_type, max_tokens }
      : { message: messageOrMessages, action_type, max_tokens };
    return cloudFetch("/api/me/ai/chat", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  analyzeDocument: (documentId, messages, action_type = "pdf_analysis") =>
    cloudFetch("/api/me/ai/analyze-document", {
      method: "POST",
      body: JSON.stringify({ document_id: documentId, messages, action_type }),
    }),
};
