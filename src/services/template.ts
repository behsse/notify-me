import type { Platform } from "../db/index.js";

export const DEFAULT_TEMPLATES: Record<Platform, string> = {
  youtube: "**{author}** vient de poster une nouvelle {type} sur YouTube !",
  twitch: "🔴 **{author}** est en LIVE sur **{game}** !",
  tiktok: "**@{author}** vient de poster un nouveau TikTok !",
};

export const AVAILABLE_PLACEHOLDERS: Record<Platform, string[]> = {
  youtube: ["{author}", "{title}", "{url}", "{type}"],
  twitch: ["{author}", "{title}", "{url}", "{game}"],
  tiktok: ["{author}", "{title}", "{url}"],
};

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\\n/g, "\n")
    .replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}
