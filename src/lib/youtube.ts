const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export type YouTubeEmbedConfig = {
  videoId: string;
  origin: string;
  embedDomain: string;
  playerUrl: string;
  chatUrl: string;
  watchUrl: string;
};

export function isValidYouTubeVideoId(videoId: string): boolean {
  return YOUTUBE_VIDEO_ID_PATTERN.test(videoId);
}

/**
 * Builds embed URLs from the page that is actually hosting the application.
 * `origin` must include scheme (and a local port); Live Chat's `embed_domain`
 * must be hostname-only, per YouTube's Live Chat embed requirements.
 */
export function createYouTubeEmbedConfig(videoId: string): YouTubeEmbedConfig | null {
  if (!isValidYouTubeVideoId(videoId) || typeof window === "undefined") return null;

  const origin = window.location.origin;
  const embedDomain = window.location.hostname;
  if (!origin || !embedDomain) return null;

  const playerUrl = new URL(`https://www.youtube.com/embed/${videoId}`);
  playerUrl.searchParams.set("enablejsapi", "1");
  playerUrl.searchParams.set("origin", origin);
  playerUrl.searchParams.set("rel", "0");

  const chatUrl = new URL("https://www.youtube.com/live_chat");
  chatUrl.searchParams.set("v", videoId);
  chatUrl.searchParams.set("embed_domain", embedDomain);

  return {
    videoId,
    origin,
    embedDomain,
    playerUrl: playerUrl.toString(),
    chatUrl: chatUrl.toString(),
    watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
  };
}
