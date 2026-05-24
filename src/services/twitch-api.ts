import { request } from "undici";
import { config, hasTwitchCredentials } from "../config.js";

const HELIX = "https://api.twitch.tv/helix";
const OAUTH = "https://id.twitch.tv/oauth2/token";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAppToken(): Promise<string> {
  if (!hasTwitchCredentials) {
    throw new Error(
      "Twitch credentials missing — set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET.",
    );
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const body = new URLSearchParams({
    client_id: config.TWITCH_CLIENT_ID!,
    client_secret: config.TWITCH_CLIENT_SECRET!,
    grant_type: "client_credentials",
  });

  const res = await request(OAUTH, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (res.statusCode !== 200) {
    const text = await res.body.text();
    throw new Error(`Twitch OAuth failed (${res.statusCode}): ${text}`);
  }

  const payload = (await res.body.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  };
  return cachedToken.value;
}

async function helix<T>(path: string, params: Record<string, string | string[]>): Promise<T> {
  const token = await getAppToken();
  const url = new URL(`${HELIX}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) url.searchParams.append(key, v);
    } else {
      url.searchParams.set(key, value);
    }
  }

  const res = await request(url, {
    headers: {
      authorization: `Bearer ${token}`,
      "client-id": config.TWITCH_CLIENT_ID!,
    },
  });

  if (res.statusCode === 401) {
    cachedToken = null;
  }
  if (res.statusCode !== 200) {
    const text = await res.body.text();
    throw new Error(`Twitch API ${path} failed (${res.statusCode}): ${text}`);
  }
  return (await res.body.json()) as T;
}

export interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
}

export interface TwitchStream {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_name: string;
  type: string;
  title: string;
  viewer_count: number;
  started_at: string;
  thumbnail_url: string;
}

export async function getUserByLogin(login: string): Promise<TwitchUser | null> {
  const res = await helix<{ data: TwitchUser[] }>("/users", { login: login.toLowerCase() });
  return res.data[0] ?? null;
}

export async function getStreamsByLogins(logins: string[]): Promise<TwitchStream[]> {
  if (logins.length === 0) return [];
  const all: TwitchStream[] = [];
  for (let i = 0; i < logins.length; i += 100) {
    const chunk = logins.slice(i, i + 100).map((l) => l.toLowerCase());
    const res = await helix<{ data: TwitchStream[] }>("/streams", { user_login: chunk });
    all.push(...res.data);
  }
  return all;
}
