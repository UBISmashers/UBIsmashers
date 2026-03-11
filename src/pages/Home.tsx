import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import HeroSection from "@/components/home/HeroSection";

const RulesSection = lazy(() => import("@/components/home/RulesSection"));
const TeamCarousel = lazy(() => import("@/components/home/TeamCarousel"));
const CTASection = lazy(() => import("@/components/home/CTASection"));
const Footer = lazy(() => import("@/components/home/Footer"));

function DeferredSection({
  children,
  minHeightClassName,
}: {
  children: ReactNode;
  minHeightClassName?: string;
}) {
  const [shouldRender, setShouldRender] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || shouldRender) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldRender]);

  return (
    <div ref={containerRef}>
      {shouldRender ? (
        <Suspense fallback={<div className={minHeightClassName || "min-h-24"} />} >
          {children}
        </Suspense>
      ) : (
        <div className={minHeightClassName || "min-h-24"} aria-hidden="true" />
      )}
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-x-hidden text-slate-900">
      <img
        src="/background.webp"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 -z-10 h-full w-full object-cover"
        loading="eager"
        fetchPriority="high"
        decoding="async"
      />
      <main className="relative z-10">
        <HeroSection />
        <DeferredSection minHeightClassName="min-h-[28rem]">
          <RulesSection />
        </DeferredSection>
        <DeferredSection minHeightClassName="min-h-[34rem]">
          <TeamCarousel />
        </DeferredSection>
        <DeferredSection minHeightClassName="min-h-[20rem]">
          <CTASection />
        </DeferredSection>
        <DeferredSection minHeightClassName="min-h-[14rem]">
          <Footer />
        </DeferredSection>
      </main>
    </div>
  );
}
