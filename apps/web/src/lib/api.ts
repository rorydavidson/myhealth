const API_BASE = import.meta.env.VITE_API_URL ?? "";

export interface UserPreferences {
  units: "metric" | "imperial";
  timezone: string;
  language: "en" | "fr";
  theme: "light" | "dark" | "system";
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail ?? error.title ?? "Request failed");
  }

  return res.json();
}

export function getPreferences(): Promise<UserPreferences> {
  return fetchApi<UserPreferences>("/api/preferences");
}

export function updatePreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences> {
  return fetchApi<UserPreferences>("/api/preferences", {
    method: "PUT",
    body: JSON.stringify(prefs),
  });
}
