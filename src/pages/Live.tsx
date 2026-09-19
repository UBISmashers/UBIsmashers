import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Eye, ExternalLink, Radio, Youtube } from "lucide-react";
import { useLiveStatus } from "@/hooks/use-live-status";
import YouTubeLivePlayer from "@/components/live/YouTubeLivePlayer";
import { createYouTubeEmbedConfig } from "@/lib/youtube";

const YOUTUBE_CHANNEL_URL = "https://youtube.com/@ubismashers";

export default function Live() {
  const { data: liveStatus, isLoading } = useLiveStatus();
  const embedConfig = liveStatus?.isLive ? createYouTubeEmbedConfig(liveStatus.videoId) : null;

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.debug("[YouTube Live] status response", liveStatus);
    if (liveStatus?.isLive && embedConfig) {
      console.debug("[YouTube Live] embed configuration", {
        videoId: liveStatus.videoId,
        embedUrl: embedConfig.playerUrl,
        origin: embedConfig.origin,
        embed_domain: embedConfig.embedDomain,
      });
    }
  }, [embedConfig, liveStatus]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#06291e] via-[#0b3d2d] to-slate-950 px-4 py-8 text-white sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-6xl">
        <Link to="/" className="text-sm font-semibold text-emerald-200 transition hover:text-white">
          ← Back to UBI Smashers
        </Link>

        <header className="mt-7 text-center sm:mt-9">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-300/40 bg-red-500/20 px-3 py-1.5 text-xs font-extrabold tracking-[0.16em] text-red-100">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" /> LIVE NOW
          </div>
          <h1 className="mt-4 text-3xl font-bold sm:text-4xl">UBI Smashers Live</h1>
        </header>

        {liveStatus?.isLive && embedConfig ? (
          <section className="mt-7 overflow-hidden rounded-3xl border border-white/15 bg-slate-950/75 p-3 shadow-2xl backdrop-blur-sm sm:mt-9 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1 sm:mb-5">
              <h2 className="text-lg font-bold text-white sm:text-xl">{liveStatus.title}</h2>
              <p className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1.5 text-sm font-semibold text-emerald-100">
                <Eye className="h-4 w-4" /> {liveStatus.viewers.toLocaleString()} Watching
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
              <YouTubeLivePlayer title={liveStatus.title} config={embedConfig} />
              <div className="hidden md:block">
                <p className="mb-2 px-1 text-sm font-bold text-white">YouTube Live Chat</p>
                <div className="overflow-hidden rounded-2xl border border-slate-700 bg-white shadow-lg md:h-[28rem] lg:h-[min(56.25vw,31rem)]">
                  <iframe
                    className="h-full w-full bg-white"
                    src={embedConfig.chatUrl}
                    title="UBI Smashers live chat"
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-300">
                  <p>Sign in with your Google account to participate. Select Live Chat, not Top Chat, to see every message.</p>
                  <a
                    href={embedConfig.watchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 font-bold text-emerald-200 transition hover:text-white"
                  >
                    Open chat on YouTube <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-center md:hidden">
              <p className="text-sm text-emerald-50">Live Chat is available on YouTube when viewing on mobile.</p>
              <a
                href={embedConfig.watchUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-emerald-200 hover:text-white"
              >
                Open live chat on YouTube <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </section>
        ) : (
          <section className="mx-auto mt-9 max-w-xl rounded-3xl border border-emerald-100/15 bg-slate-900/80 px-6 py-12 text-center shadow-2xl backdrop-blur-sm">
            <Radio className="mx-auto h-10 w-10 text-emerald-300" />
            <h2 className="mt-5 text-xl font-bold">{isLoading ? "Checking for a live match…" : "No live matches currently in progress."}</h2>
            <p className="mt-3 text-sm leading-6 text-emerald-100/80">Follow us on YouTube for upcoming streams.</p>
            <a
              href={YOUTUBE_CHANNEL_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-red-500"
            >
              <Youtube className="h-4 w-4" /> Visit YouTube Channel
            </a>
          </section>
        )}
      </div>
    </main>
  );
}
