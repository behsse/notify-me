import type { Platform } from "../db/index.js";

export const DEFAULT_TEMPLATES: Record<Platform, string> = {
  youtube: "**{author}** vient de poster une nouvelle {type} sur YouTube !",
  twitch: "🔴 **{author}** est en LIVE sur **{game}** !",
  tiktok: "**@{author}** vient de poster un nouveau TikTok !",
};

export const DEFAULT_COLORS: Record<Platform, number> = {
  youtube: 0xff0000,
  twitch: 0x9146ff,
  tiktok: 0xfe2c55,
};

export const AVAILABLE_PLACEHOLDERS: Record<Platform, string[]> = {
  youtube: ["{author}", "{title}", "{url}", "{type}"],
  twitch: ["{author}", "{title}", "{url}", "{game}"],
  tiktok: ["{author}", "{title}", "{url}"],
};

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Parse a hex color string (#fff, #ffffff, ffffff) into a 0xRRGGBB integer.
 * Returns null if the input is invalid.
 */
export function parseHexColor(input: string): number | null {
  const m = input.trim().match(HEX_RE);
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  return parseInt(hex, 16);
}

export function formatHexColor(color: number): string {
  return "#" + color.toString(16).padStart(6, "0").toUpperCase();
}
