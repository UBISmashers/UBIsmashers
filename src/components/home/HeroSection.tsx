import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, Image, ShieldCheck, Users, Wallet, Trophy } from "lucide-react";

const HeroLoginDialog = lazy(() => import("@/components/home/HeroLoginDialog"));

export default function HeroSection() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const glassButtonClass =
    "inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/25 bg-[#0F3D2E] px-5 py-3 text-sm font-semibold text-[#FFFFFF] shadow-lg transition-all duration-300 hover:scale-[1.03] hover:bg-[#14532D] hover:shadow-[0_0_30px_rgba(20,83,45,0.35)]";

  return (
    <section
      className="relative min-h-screen px-4 sm:px-6 lg:px-8"
    >
      <div className="absolute inset-0 bg-black/15" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center pb-10 pt-8 text-center text-white sm:pb-12 sm:pt-10">
        <div className="mt-2 sm:mt-0">
          <div className="mb-6 flex justify-center">
            <div className="rounded-2xl border border-white/35 bg-white/10 p-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <img
                src="/icon.jpeg"
                alt="UBI Smashers team symbol"
                width="96"
                height="96"
                fetchPriority="high"
                className="h-20 w-20 rounded-xl object-cover sm:h-24 sm:w-24"
              />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">UBI Smashers</h1>
          <p className="mt-3 text-sm font-semibold tracking-[0.16em] text-emerald-100 sm:text-base lg:text-lg">
            SMASH HARD | PLAY FAIR | STAY UNITED
          </p>
        </div>

        <div className="mt-10 w-full max-w-3xl sm:mt-12">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <button type="button" className={glassButtonClass} onClick={() => setIsLoginOpen(true)}>
              <ShieldCheck className="h-4 w-4" />
              Admin Login
            </button>
            <Link to="/member-bills" className={glassButtonClass}>
              <Wallet className="h-4 w-4" />
              View Member Bills
            </Link>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:mt-4 sm:grid-cols-2 sm:gap-4">
            <a href="#rules" className={glassButtonClass}>
              <ClipboardList className="h-4 w-4" />
              Club Rules
            </a>
            <a
              href="https://drive.google.com/drive/folders/17V78oLVfDQLuhVvo4y4D7IUt-GVJr95p"
              target="_blank"
              rel="noreferrer"
              className={glassButtonClass}
            >
              <Image className="h-4 w-4" />
              Team Gallery
            </a>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:mt-4 sm:grid-cols-2 sm:gap-4">
            <a href="#team" className={glassButtonClass}>
              <Users className="h-4 w-4" />
              Meet the Team
            </a>
            <Link to="/signup" className={glassButtonClass}>
              <Trophy className="h-4 w-4" />
              Join UBI Smashers
            </Link>
          </div>

        </div>
      </div>
      {isLoginOpen ? (
        <Suspense fallback={null}>
          <HeroLoginDialog open={isLoginOpen} onOpenChange={setIsLoginOpen} />
        </Suspense>
      ) : null}
    </section>
  );
}
