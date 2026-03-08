import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  // In production the API is served through the same nginx that serves the SPA,
  // so window.location.origin is always the correct base URL.
  // In dev, VITE_API_URL is set to http://localhost:3001 by the Vite dev proxy.
  baseURL: import.meta.env.VITE_API_URL ?? (typeof window !== "undefined" ? window.location.origin : "http://localhost:3001"),
  plugins: [magicLinkClient()],
});

export const { useSession, signIn, signOut } = authClient;
