import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import authEn from "../locales/en/auth.json";
// Import translation files
import commonEn from "../locales/en/common.json";
import conditionsEn from "../locales/en/conditions.json";
import dashboardEn from "../locales/en/dashboard.json";
import importEn from "../locales/en/import.json";
import insightsEn from "../locales/en/insights.json";
import ipsEn from "../locales/en/ips.json";
import labResultsEn from "../locales/en/lab-results.json";
import settingsEn from "../locales/en/settings.json";
import authFr from "../locales/fr/auth.json";
import commonFr from "../locales/fr/common.json";
import conditionsFr from "../locales/fr/conditions.json";
import dashboardFr from "../locales/fr/dashboard.json";
import importFr from "../locales/fr/import.json";
import insightsFr from "../locales/fr/insights.json";
import ipsFr from "../locales/fr/ips.json";
import labResultsFr from "../locales/fr/lab-results.json";
import settingsFr from "../locales/fr/settings.json";

export const defaultNS = "common";

export const resources = {
  en: {
    common: commonEn,
    auth: authEn,
    conditions: conditionsEn,
    dashboard: dashboardEn,
    import: importEn,
    insights: insightsEn,
    "lab-results": labResultsEn,
    settings: settingsEn,
    ips: ipsEn,
  },
  fr: {
    common: commonFr,
    auth: authFr,
    conditions: conditionsFr,
    dashboard: dashboardFr,
    import: importFr,
    insights: insightsFr,
    "lab-results": labResultsFr,
    settings: settingsFr,
    ips: ipsFr,
  },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    defaultNS,
    fallbackLng: "en",
    supportedLngs: ["en", "fr"],
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "health-app-language",
    },
  });

export default i18n;
