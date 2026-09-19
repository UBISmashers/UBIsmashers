import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, ExternalLink } from "lucide-react";
import type { YouTubeEmbedConfig } from "@/lib/youtube";

type YouTubePlayerErrorEvent = { data: number };
type YouTubePlayerInstance = { destroy: () => void };
type YouTubeApi = {
  Player: new (
    element: HTMLIFrameElement,
    options: { events?: { onError?: (event: YouTubePlayerErrorEvent) => void } }
  ) => YouTubePlayerInstance;
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YouTubeApi> | undefined;

function loadYouTubeIframeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]'
    );
    const script = existingScript || document.createElement("script");
    const previousReadyHandler = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      previousReadyHandler?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube IFrame API loaded without a player instance."));
    };

    script.onerror = () => reject(new Error("Unable to load the YouTube IFrame API."));
    if (!existingScript) {
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return youtubeApiPromise;
}

export default function YouTubeLivePlayer({
  title,
  config,
}: {
  title: string;
  config: YouTubeEmbedConfig;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const reactId = useId().replace(/:/g, "");
  const [embedError, setEmbedError] = useState(false);

  useEffect(() => {
    let disposed = false;
    setEmbedError(false);

    loadYouTubeIframeApi()
      .then((youtube) => {
        if (disposed || !iframeRef.current) return;
        playerRef.current = new youtube.Player(iframeRef.current, {
          events: {
            onError: (event) => {
              if (!disposed) setEmbedError(true);
              if (import.meta.env.DEV) {
                console.debug("[YouTube Live] player error", { code: event.data, videoId: config.videoId });
              }
            },
          },
        });
      })
      .catch((error: unknown) => {
        // The direct iframe remains usable if the optional API script is blocked.
        if (import.meta.env.DEV) console.debug("[YouTube Live] IFrame API unavailable", error);
      });

    return () => {
      disposed = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [config.playerUrl]);

  return (
    <div className="space-y-3">
      <div className="aspect-video overflow-hidden rounded-2xl bg-black shadow-lg">
        <iframe
          ref={iframeRef}
          id={`youtube-live-player-${reactId}`}
          className="h-full w-full"
          src={config.playerUrl}
          title={title}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          onError={() => setEmbedError(true)}
        />
      </div>

      {embedError ? (
        <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-center sm:flex-row sm:text-left">
          <p className="inline-flex items-center justify-center gap-2 text-sm font-medium text-amber-50">
            <AlertCircle className="h-4 w-4 shrink-0" /> Unable to load live stream inside the website.
          </p>
          <a
            href={config.watchUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-500"
          >
            Watch on YouTube <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      ) : null}
    </div>
  );
}
