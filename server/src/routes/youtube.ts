import { Router } from "express";

const router = Router();
const CACHE_TTL_MS = 30_000;

type LiveStatus =
  | { isLive: false; reason: string }
  | { isLive: true; videoId: string; title: string; viewers: number; reason: string };

type LiveCandidate = {
  videoId: string;
  title?: string;
  searchLiveBroadcastContent?: string;
  eventType: "live";
};

type VideoDetails = {
  id?: string;
  snippet?: { title?: string; liveBroadcastContent?: string };
  status?: { embeddable?: boolean; privacyStatus?: string };
  liveStreamingDetails?: { concurrentViewers?: string };
};

let cachedStatus: LiveStatus | undefined;
let cacheExpiresAt = 0;

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const isDebugEnabled = () => process.env.NODE_ENV !== "production" || process.env.YOUTUBE_DEBUG === "true";

export const shouldAcceptLiveCandidate = (
  videoId: string,
  eventType: "live" | undefined,
  liveBroadcastContent: string | undefined
) =>
  YOUTUBE_VIDEO_ID_PATTERN.test(videoId) &&
  (eventType === "live" || liveBroadcastContent === "live");

const debugLog = (message: string, data?: unknown) => {
  if (!isDebugEnabled()) return;
  console.info(`[YouTube live-status] ${message}`, data ?? "");
};

const youtubeApiUrl = (path: string, params: Record<string, string>) => {
  const search = new URLSearchParams(params);
  return `https://www.googleapis.com/youtube/v3/${path}?${search.toString()}`;
};

const getChannelId = async (apiKey: string) => {
  if (process.env.YOUTUBE_CHANNEL_ID) {
    debugLog("using configured channel ID", { channelId: process.env.YOUTUBE_CHANNEL_ID });
    return process.env.YOUTUBE_CHANNEL_ID;
  }

  const handle = process.env.YOUTUBE_CHANNEL_HANDLE || "@ubismashers";
  const response = await fetch(
    youtubeApiUrl("channels", { part: "id", forHandle: handle, key: apiKey })
  );
  if (!response.ok) throw new Error(`YouTube channel lookup failed (${response.status})`);

  const payload = (await response.json()) as { items?: Array<{ id?: string }> };
  const channelId = payload.items?.[0]?.id;
  if (!channelId) throw new Error("YouTube channel could not be resolved");
  debugLog("resolved channel ID", { channelId, handle });
  return channelId;
};

const fetchLiveStatus = async (): Promise<LiveStatus> => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn("YouTube live status is disabled: YOUTUBE_API_KEY is not configured.");
    return { isLive: false, reason: "YOUTUBE_API_KEY is not configured" };
  }

  const channelId = await getChannelId(apiKey);
  debugLog("checking channel for active live streams", { channelId });
  const searchResponse = await fetch(
    youtubeApiUrl("search", {
      part: "id,snippet",
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
    items?: Array<{
      id?: { videoId?: string };
      snippet?: { title?: string; liveBroadcastContent?: string };
    }>;
  };
  debugLog("search API response", searchPayload);

  // `eventType=live` is YouTube's public indication that a search result is
  // currently live. Scheduled streams do not match this query.
  const candidates: LiveCandidate[] = [];
  for (const item of searchPayload.items || []) {
    const videoId = item.id?.videoId;
    if (!videoId || !YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) {
      debugLog("rejected search item", { videoId: videoId ?? "unavailable", reason: "Invalid YouTube video ID" });
      continue;
    }
    candidates.push({
      videoId,
      title: item.snippet?.title,
      searchLiveBroadcastContent: item.snippet?.liveBroadcastContent,
      eventType: "live",
    });
  }
  const uniqueCandidates = candidates.filter(
    (candidate, index) => candidates.findIndex((other) => other.videoId === candidate.videoId) === index
  );

  if (uniqueCandidates.length === 0) {
    return { isLive: false, reason: "YouTube eventType=live search returned no valid video IDs" };
  }

  debugLog("live candidates accepted from search", uniqueCandidates);

  let videosById = new Map<string, VideoDetails>();

  try {
    const videoResponse = await fetch(
      youtubeApiUrl("videos", {
        part: "snippet,liveStreamingDetails,status",
        id: uniqueCandidates.map((candidate) => candidate.videoId).join(","),
        key: apiKey,
      })
    );
    if (!videoResponse.ok) {
      debugLog("video details lookup failed; accepting active search result", { status: videoResponse.status });
    } else {
      const videoPayload = (await videoResponse.json()) as { items?: VideoDetails[] };
      debugLog("video API response", videoPayload);
      videosById = new Map(
        (videoPayload.items || [])
          .filter((video): video is VideoDetails & { id: string } => Boolean(video.id))
          .map((video) => [video.id, video] as const)
      );
    }
  } catch (error) {
    debugLog("video details lookup threw; accepting active search result", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Search results are already active by virtue of eventType=live. Video
  // details improve title/viewer data but `status` fields are optional public
  // metadata and must never reject an otherwise active stream.
  for (const candidate of uniqueCandidates) {
    const video = videosById.get(candidate.videoId);
    const liveBroadcastContent = video?.snippet?.liveBroadcastContent || candidate.searchLiveBroadcastContent;
    const isActive = shouldAcceptLiveCandidate(candidate.videoId, candidate.eventType, liveBroadcastContent);
    const reason = isActive
      ? candidate.eventType === "live"
        ? "Accepted: YouTube search returned this video for eventType=live"
        : "Accepted: YouTube reported liveBroadcastContent=live"
      : "Rejected: YouTube did not report an active live state";

    debugLog("candidate evaluation", {
      videoId: candidate.videoId,
      title: video?.snippet?.title || candidate.title,
      eventType: candidate.eventType,
      liveBroadcastContent,
      privacyStatus: video?.status?.privacyStatus ?? "unavailable",
      embeddable: video?.status?.embeddable ?? "unavailable",
      reason,
    });

    if (!isActive) continue;
    return {
      isLive: true,
      videoId: candidate.videoId,
      title: video?.snippet?.title || candidate.title || "UBI Smashers Live Stream",
      viewers: Number.parseInt(video?.liveStreamingDetails?.concurrentViewers || "0", 10) || 0,
      reason,
    };
  }

  return { isLive: false, reason: "All live-search candidates were rejected" };
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
    cachedStatus = {
      isLive: false,
      reason: `YouTube API request failed: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }

  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  res.set("Cache-Control", "public, max-age=30");
  return res.json(cachedStatus);
});

export default router;
