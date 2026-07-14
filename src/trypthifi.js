// Thin client for a self-hosted TrypT-hifi (Qobuz-DL) instance.
// It only talks to two routes that already exist in that project:
//   GET /api/get-music?q=...&offset=0        -> Qobuz search results
//   GET /api/download-music?track_id=..&quality=.. -> { url } signed CDN link
import { config } from './config.js';

// Build the Token-Country header only if the user configured a country.
function headers() {
  const h = { Accept: 'application/json' };
  if (config.trypthifi.country) h['Token-Country'] = config.trypthifi.country;
  return h;
}

function normalizeArtUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('/')) return `${config.trypthifi.baseUrl}${trimmed}`;
  return trimmed;
}

function chooseAlbumArtUrl(album) {
  if (!album || typeof album !== 'object') return null;

  const candidates = [];
  const push = (value) => {
    const normalized = normalizeArtUrl(value);
    if (normalized) candidates.push(normalized);
  };

  // Nested image objects, largest first. Qobuz returns
  //   image: { small, thumbnail, large, back }
  // Other providers may use nested { url } / { xl }.
  for (const key of ['image', 'cover', 'picture', 'artwork']) {
    const obj = album?.[key];
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      push(obj.xl);
      push(obj.large);
      push(obj.url);
      push(obj.medium);
      push(obj.small);
      push(obj.thumbnail);
    }
  }

  // Flat string fields (Deezer-style shapes).
  push(album.cover_xl);
  push(album.cover_big);
  push(album.cover_medium);
  push(album.cover_small);
  push(album.cover);
  push(album.image);
  push(album.picture);
  push(album.thumbnail);
  push(album.artwork);
  push(album.url);
  push(album.coverUrl ?? album.cover_url);
  push(album.imageUrl ?? album.image_url);

  if (Array.isArray(album.images)) {
    for (const item of album.images) {
      if (typeof item === 'string') push(item);
      else if (item?.url) push(item.url);
    }
  }

  return candidates.length ? candidates[0] : null;
}

// Search and return a normalized list of tracks. The raw Qobuz shape is
// data.tracks.items[]; we defensively default in case a field is missing.
export async function searchTracks(query, limit = 10) {
  const url = `${config.trypthifi.baseUrl}/api/get-music?q=${encodeURIComponent(query)}&offset=0`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`Search failed (HTTP ${res.status}). Is TrypT-hifi running at ${config.trypthifi.baseUrl}?`);

  const json = await res.json();
  if (!json.success) throw new Error(`Search error: ${JSON.stringify(json.error)}`);

  const items = json?.data?.tracks?.items ?? [];
  return items.slice(0, limit).map((t) => ({
    id: t.id,
    title: t.title,
    artist: t?.performer?.name ?? t?.album?.artist?.name ?? 'Unknown artist',
    album: t?.album?.title ?? '',
    durationSec: t.duration ?? 0,
    artUrl: chooseAlbumArtUrl(t?.album ?? t),
  }));
}

// Ask the backend for a playable/downloadable signed URL for one track.
export async function getStreamUrl(trackId, quality = config.trypthifi.defaultQuality) {
  const url = `${config.trypthifi.baseUrl}/api/download-music?track_id=${trackId}&quality=${quality}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`Download-URL request failed (HTTP ${res.status}).`);

  const json = await res.json();
  if (!json.success || !json?.data?.url) {
    throw new Error(`Could not get a stream URL: ${JSON.stringify(json.error ?? json)}`);
  }
  return json.data.url;
}

// Small helper: 214 -> "3:34" for nice display.
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const rem = String(s % 60).padStart(2, '0');
  return `${m}:${rem}`;
}
