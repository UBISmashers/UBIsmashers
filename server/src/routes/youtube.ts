import { Router } from "express";

const router = Router();
const CACHE_TTL_MS = 30_000;

type LiveStatus =
  | { isLive: false }
  | { isLive: true; videoId: string; title: string; viewers: number };

let cachedStatus: LiveStatus | undefined;
let cacheExpiresAt = 0;

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const youtubeApiUrl = (path: string, params: Record<string, string>) => {
  const search = new URLSearchParams(params);
  return `https://www.googleapis.com/youtube/v3/${path}?${search.toString()}`;
};

const getChannelId = async (apiKey: string) => {
  if (process.env.YOUTUBE_CHANNEL_ID) return process.env.YOUTUBE_CHANNEL_ID;

  const handle = process.env.YOUTUBE_CHANNEL_HANDLE || "@ubismashers";
  const response = await fetch(
    youtubeApiUrl("channels", { part: "id", forHandle: handle, key: apiKey })
  );
  if (!response.ok) throw new Error(`YouTube channel lookup failed (${response.status})`);

  const payload = (await response.json()) as { items?: Array<{ id?: string }> };
  const channelId = payload.items?.[0]?.id;
  if (!channelId) throw new Error("YouTube channel could not be resolved");
  return channelId;
};

const fetchLiveStatus = async (): Promise<LiveStatus> => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn("YouTube live status is disabled: YOUTUBE_API_KEY is not configured.");
    return { isLive: false };
  }

  const channelId = await getChannelId(apiKey);
  const searchResponse = await fetch(
    youtubeApiUrl("search", {
      part: "id",
      channelId,
      eventType: "live",
      type: "video",
      // eventType=live excludes upcoming/scheduled broadcasts. Fetch a small set
      // and validate each resource below so an API search result can never be
      // returned directly as an embeddable live video.
      maxResults: "5",
      key: apiKey,
    })
  );
  if (!searchResponse.ok) throw new Error(`YouTube live search failed (${searchResponse.status})`);

  const searchPayload = (await searchResponse.json()) as {
    items?: Array<{ id?: { videoId?: string } }>;
  };
  const candidateVideoIds = Array.from(
    new Set(
      (searchPayload.items || [])
        .map((item) => item.id?.videoId)
        .filter((videoId): videoId is string => Boolean(videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId)))
    )
  );
  if (candidateVideoIds.length === 0) return { isLive: false };

  const videoResponse = await fetch(
    youtubeApiUrl("videos", {
      part: "snippet,liveStreamingDetails,status",
      id: candidateVideoIds.join(","),
      key: apiKey,
    })
  );
  if (!videoResponse.ok) throw new Error(`YouTube video lookup failed (${videoResponse.status})`);

  const videoPayload = (await videoResponse.json()) as {
    items?: Array<{
      id?: string;
      snippet?: { title?: string; liveBroadcastContent?: string };
      status?: { embeddable?: boolean; privacyStatus?: string };
      liveStreamingDetails?: { concurrentViewers?: string };
    }>;
  };
  const video = videoPayload.items?.find(
    (item) =>
      Boolean(item.id && YOUTUBE_VIDEO_ID_PATTERN.test(item.id)) &&
      item.snippet?.liveBroadcastContent === "live" &&
      item.status?.embeddable === true &&
      item.status?.privacyStatus === "public"
  );
  if (!video) return { isLive: false };

  return {
    isLive: true,
    videoId: video.id!,
    title: video.snippet?.title || "UBI Smashers Live Stream",
    viewers: Number.parseInt(video.liveStreamingDetails?.concurrentViewers || "0", 10) || 0,
  };
};

router.get("/live-status", async (_req, res) => {
  if (cachedStatus && Date.now() < cacheExpiresAt) {
    res.set("Cache-Control", "public, max-age=30");
    return res.json(cachedStatus);
  }

  try {
    cachedStatus = await fetchLiveStatus();
  } catch (error) {
    console.error("Unable to fetch YouTube live status:", error);
    // An unavailable upstream must never prevent the public site from loading.
    cachedStatus = { isLive: false };
  }

  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  res.set("Cache-Control", "public, max-age=30");
  return res.json(cachedStatus);
});

export default router;
