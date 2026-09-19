import { Link } from "react-router-dom";
import { Eye, Radio, Youtube } from "lucide-react";
import { useLiveStatus } from "@/hooks/use-live-status";

const YOUTUBE_CHANNEL_URL = "https://youtube.com/@ubismashers";

export default function Live() {
  const { data: liveStatus, isLoading } = useLiveStatus();
  const embedDomain = typeof window === "undefined" ? "localhost" : window.location.hostname;

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

        {liveStatus?.isLive ? (
          <section className="mt-7 overflow-hidden rounded-3xl border border-white/15 bg-slate-950/75 p-3 shadow-2xl backdrop-blur-sm sm:mt-9 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1 sm:mb-5">
              <h2 className="text-lg font-bold text-white sm:text-xl">{liveStatus.title}</h2>
              <p className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1.5 text-sm font-semibold text-emerald-100">
                <Eye className="h-4 w-4" /> {liveStatus.viewers.toLocaleString()} Watching
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
              <div className="aspect-video overflow-hidden rounded-2xl bg-black shadow-lg">
                <iframe
                  className="h-full w-full"
                  src={`https://www.youtube.com/embed/${liveStatus.videoId}?autoplay=0&rel=0`}
                  title={liveStatus.title}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black lg:h-[min(56.25vw,31rem)]">
                <iframe
                  className="h-[28rem] w-full lg:h-full"
                  src={`https://www.youtube.com/live_chat?v=${liveStatus.videoId}&embed_domain=${encodeURIComponent(embedDomain)}`}
                  title="UBI Smashers live chat"
                  loading="lazy"
                />
              </div>
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
