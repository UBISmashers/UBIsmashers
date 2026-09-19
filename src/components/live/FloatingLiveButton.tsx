import { Link } from "react-router-dom";
import { Radio } from "lucide-react";
import { useLiveStatus } from "@/hooks/use-live-status";

export default function FloatingLiveButton() {
  const { data: liveStatus } = useLiveStatus();
  if (!liveStatus?.isLive) return null;

  return (
    <Link
      to="/live"
      className="fixed bottom-5 right-4 z-50 inline-flex items-center gap-2 rounded-full border border-red-200/60 bg-red-600 px-4 py-3 text-sm font-extrabold tracking-wide text-white shadow-[0_10px_28px_rgba(220,38,38,0.45)] transition hover:scale-105 hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2 sm:bottom-6 sm:right-6"
      aria-label="Watch the UBI Smashers live stream"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
      </span>
      <Radio className="h-4 w-4" /> LIVE
    </Link>
  );
}
