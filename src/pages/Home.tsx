import { CTASection } from "@/components/home/CTASection";
import { Footer } from "@/components/home/Footer";
import { HeroSection } from "@/components/home/HeroSection";
import { RulesSection } from "@/components/home/RulesSection";
import { TeamCarousel } from "@/components/home/TeamCarousel";

export default function Home() {
  return (
    <div
      className="min-h-screen text-slate-900"
      style={{
        backgroundImage: "url('/background.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <HeroSection />
      <RulesSection />
      <TeamCarousel />
      <CTASection />
      <Footer />
    </div>
  );
}
