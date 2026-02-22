import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getPreferences, type UserPreferences, updatePreferences } from "@/lib/api";

export function usePreferences() {
  const { i18n } = useTranslation();

  return useQuery({
    queryKey: ["preferences"],
    queryFn: async () => {
      const prefs = await getPreferences();
      // Sync language from server preference
      if (prefs.language && prefs.language !== i18n.language) {
        i18n.changeLanguage(prefs.language);
      }
      // Sync theme from server preference
      applyTheme(prefs.theme);
      return prefs;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();

  return useMutation({
    mutationFn: updatePreferences,
    onSuccess: (updated: UserPreferences) => {
      queryClient.setQueryData(["preferences"], updated);

      // Apply language change immediately
      if (updated.language !== i18n.language) {
        i18n.changeLanguage(updated.language);
        localStorage.setItem("health-app-language", updated.language);
      }

      // Apply theme change immediately
      applyTheme(updated.theme);
    },
  });
}

function applyTheme(theme: string) {
  const root = document.documentElement;

  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else {
    // System preference
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
  }
}
