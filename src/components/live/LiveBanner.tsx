import { Link } from "react-router-dom";
import { Eye, Radio, ChevronRight } from "lucide-react";
import { useLiveStatus } from "@/hooks/use-live-status";

export default function LiveBanner() {
  const { data: liveStatus } = useLiveStatus();
  if (!liveStatus?.isLive) return null;

  return (
    <Link
      to="/live"
      className="group mb-5 flex w-full items-center gap-3 rounded-2xl border border-red-300/50 bg-gradient-to-r from-red-700/95 via-red-600/95 to-emerald-800/95 px-4 py-3 text-left shadow-[0_12px_32px_rgba(127,29,29,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(127,29,29,0.45)] sm:mb-6 sm:px-5"
      aria-label="Watch UBI Smashers live stream"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/35">
        <Radio className="h-4 w-4 animate-pulse" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="mb-0.5 flex items-center gap-2 text-[11px] font-extrabold tracking-[0.16em] text-red-100">
          <span className="h-2 w-2 rounded-full bg-red-200 animate-pulse" /> LIVE NOW
        </span>
        <span className="block truncate text-sm font-bold text-white sm:text-base">{liveStatus.title}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-red-50">
          <Eye className="h-3.5 w-3.5" /> {liveStatus.viewers.toLocaleString()} Watching
        </span>
      </span>
      <span className="hidden items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-red-700 sm:flex">
        Watch Live <ChevronRight className="h-3.5 w-3.5" />
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-white sm:hidden" />
    </Link>
  );
}
