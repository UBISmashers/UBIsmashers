import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const teamImages = ["/img1.jpeg", "/img2.jpeg", "/img3.jpeg", "/img4.jpeg", "/img6.jpeg"];

function getItemsPerView(width: number): number {
  if (width >= 1024) return 3;
  if (width >= 640) return 2;
  return 1;
}

export function TeamCarousel() {
  const [itemsPerView, setItemsPerView] = useState(() =>
    typeof window === "undefined" ? 1 : getItemsPerView(window.innerWidth),
  );
  const [index, setIndex] = useState(0);

  const maxIndex = Math.max(0, teamImages.length - itemsPerView);
  const dots = maxIndex + 1;

  useEffect(() => {
    const onResize = () => {
      const nextPerView = getItemsPerView(window.innerWidth);
      setItemsPerView((current) => (current === nextPerView ? current : nextPerView));
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    setIndex((current) => Math.min(current, maxIndex));
  }, [maxIndex]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current >= maxIndex ? 0 : current + 1));
    }, 3500);

    return () => window.clearInterval(timer);
  }, [maxIndex]);

  const itemWidth = useMemo(() => 100 / itemsPerView, [itemsPerView]);

  const goPrev = () => setIndex((current) => (current <= 0 ? maxIndex : current - 1));
  const goNext = () => setIndex((current) => (current >= maxIndex ? 0 : current + 1));

  return (
    <section id="team" className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">👥 Meet Our Team</h2>

        <div className="relative mt-8">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous team images"
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 text-emerald-700 shadow-md transition hover:bg-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="overflow-hidden rounded-2xl">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${index * itemWidth}%)` }}
            >
              {teamImages.map((image) => (
                <div
                  key={image}
                  className="px-2"
                  style={{ minWidth: `${itemWidth}%`, maxWidth: `${itemWidth}%` }}
                >
                  <div className="group overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
                    <img
                      src={image}
                      alt="UBISmashers team"
                      className="h-64 w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-72"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={goNext}
            aria-label="Next team images"
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 text-emerald-700 shadow-md transition hover:bg-white"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          {Array.from({ length: dots }).map((_, dotIndex) => (
            <button
              key={dotIndex}
              type="button"
              aria-label={`Go to slide ${dotIndex + 1}`}
              onClick={() => setIndex(dotIndex)}
              className={`h-2.5 rounded-full transition-all ${
                index === dotIndex ? "w-6 bg-emerald-600" : "w-2.5 bg-emerald-200"
              }`}
            />
          ))}
        </div>

        <p className="mt-6 text-center text-sm font-medium text-slate-600 sm:text-base">
          Stronger Together. Every Game Counts.
        </p>
      </div>
    </section>
  );
}
