const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");

export type Session = {
  token: string;
  user: { id: string; name: string; email: string; role: UserRole; branch?: { id: string; name: string; code: string } };
};

export type UserRole = "ADMIN" | "MANAGER" | "CASHIER" | "INVENTORY_STAFF" | "DELIVERY_STAFF" | "DEMO_VIEWER";

export function isDemoViewer() {
  return getSession()?.user.role === "DEMO_VIEWER";
}

export function getSession(): Session | null {
  const raw = localStorage.getItem("pos_session");
  return raw ? JSON.parse(raw) as Session : null;
}

export function setSession(session: Session | null) {
  if (session) localStorage.setItem("pos_session", JSON.stringify(session));
  else localStorage.removeItem("pos_session");
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = getSession();
  const method = (options.method ?? "GET").toUpperCase();
  if (session?.user.role === "DEMO_VIEWER" && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    throw new Error("Demo account is read-only. This action is disabled.");
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...options.headers
    }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Request failed");
  return body.data as T;
}

export async function downloadCsv(path: string, filename: string) {
  const session = getSession();
  const res = await fetch(`${API_URL}${path}`, {
    headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {}
  });
  if (!res.ok) throw new Error("CSV export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
