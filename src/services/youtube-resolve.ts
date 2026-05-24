import { request } from "undici";

const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;

export interface YoutubeChannelInfo {
  channelId: string;
  channelName: string;
}

/**
 * Resolve a user input (channel URL, @handle, custom URL, or raw channel ID)
 * into a YouTube channel id + display name. No API key required — we scrape
 * the public channel page and read the embedded meta tags.
 */
export async function resolveYoutubeChannel(input: string): Promise<YoutubeChannelInfo> {
  const trimmed = input.trim();

  if (CHANNEL_ID_RE.test(trimmed)) {
    const name = await fetchChannelName(`https://www.youtube.com/channel/${trimmed}`);
    return { channelId: trimmed, channelName: name ?? trimmed };
  }

  const url = buildChannelUrl(trimmed);
  const { html, channelId } = await fetchChannelPage(url);

  if (!channelId) {
    throw new Error(
      "Could not extract a YouTube channel ID from this input. Try the full channel URL.",
    );
  }

  const name = extractMeta(html, "og:title") ?? channelId;
  return { channelId, channelName: name };
}

function buildChannelUrl(input: string): string {
  if (/^https?:\/\//i.test(input)) return input;
  if (input.startsWith("@")) return `https://www.youtube.com/${input}`;
  if (CHANNEL_ID_RE.test(input)) return `https://www.youtube.com/channel/${input}`;
  return `https://www.youtube.com/@${input}`;
}

async function fetchChannelPage(url: string): Promise<{ html: string; channelId: string | null }> {
  const res = await request(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; NotifyMeBot/0.1; +https://github.com/)",
      "accept-language": "en-US,en;q=0.9",
    },
    maxRedirections: 5,
  });

  if (res.statusCode >= 400) {
    throw new Error(`YouTube returned HTTP ${res.statusCode} for ${url}`);
  }

  const html = await res.body.text();
  const channelId =
    extractMeta(html, "channelId") ??
    matchOnce(html, /"channelId":"(UC[A-Za-z0-9_-]{22})"/) ??
    matchOnce(html, /\/channel\/(UC[A-Za-z0-9_-]{22})/);

  return { html, channelId };
}

async function fetchChannelName(url: string): Promise<string | null> {
  try {
    const { html } = await fetchChannelPage(url);
    return extractMeta(html, "og:title");
  } catch {
    return null;
  }
}

function extractMeta(html: string, name: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:itemprop|property|name)=["']${escapeRegex(name)}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  return matchOnce(html, re);
}

function matchOnce(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m?.[1] ?? null;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
