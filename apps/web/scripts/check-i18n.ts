#!/usr/bin/env tsx
/**
 * i18n completeness check.
 * Verifies that every key present in the English locale files
 * also exists in all other locale files.
 * Exits with code 1 if any keys are missing (for CI).
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, "../src/locales");
const SOURCE_LANG = "en";

function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const sourceDir = join(LOCALES_DIR, SOURCE_LANG);
const namespaces = readdirSync(sourceDir).filter((f) => f.endsWith(".json"));
const targetLangs = readdirSync(LOCALES_DIR).filter(
  (d) => d !== SOURCE_LANG && existsSync(join(LOCALES_DIR, d)),
);

let hasErrors = false;

for (const ns of namespaces) {
  const sourcePath = join(sourceDir, ns);
  const sourceData = JSON.parse(readFileSync(sourcePath, "utf-8")) as Record<string, unknown>;
  const sourceKeys = flattenKeys(sourceData);

  for (const lang of targetLangs) {
    const targetPath = join(LOCALES_DIR, lang, ns);
    if (!existsSync(targetPath)) {
      console.error(`Missing file: ${lang}/${ns}`);
      hasErrors = true;
      continue;
    }

    const targetData = JSON.parse(readFileSync(targetPath, "utf-8")) as Record<string, unknown>;
    const targetKeys = new Set(flattenKeys(targetData));

    for (const key of sourceKeys) {
      if (!targetKeys.has(key)) {
        console.error(`Missing key in ${lang}/${ns}: "${key}"`);
        hasErrors = true;
      }
    }
  }
}

if (!hasErrors) {
  console.log("All i18n keys are present in all locales.");
} else {
  process.exit(1);
}
