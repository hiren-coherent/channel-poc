// Client side of the channel system: the registry the workflows publish, and the
// cookie the router reads. Mirrors deployment-channel.tsx in platform-ui.

export const DEFAULT_CHANNEL = 'development';
// Same rule as the router (pages-root/index.html) and scripts/channel-registry.js.
export const CHANNEL_REGEX = /^[A-Za-z0-9_-]{1,20}$/;

export interface ChannelEntry {
  channel_name: string;
  branch_name: string | null;
}

// Each build is served from <site root>/<channel>/; the site root holds the router
// page and channel.json.
export const SITE_ROOT = new URL('../', window.location.href);

export async function fetchRegistry(): Promise<ChannelEntry[]> {
  // no-store: GitHub Pages caches for 10 minutes, and the registry changes on every deploy.
  const response = await fetch(new URL('channel.json', SITE_ROOT), { cache: 'no-store' });
  if (!response.ok) throw new Error(`channel.json returned HTTP ${response.status}`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error('channel.json is not a JSON array');
  // Bare strings are the legacy registry format.
  return data
    .map((entry) => (typeof entry === 'string' ? { channel_name: entry, branch_name: null } : entry))
    .filter(
      (entry): entry is ChannelEntry =>
        typeof entry?.channel_name === 'string' && CHANNEL_REGEX.test(entry.channel_name),
    );
}

// What platform-ui's /api/cookie?action=set does at the edge, then a trip back through
// the router so it picks the new channel.
export function switchChannel(channel: string): void {
  document.cookie = `channel=${channel}; Path=${SITE_ROOT.pathname}; Max-Age=604800; SameSite=Lax; Secure`;
  window.location.assign(SITE_ROOT);
}
