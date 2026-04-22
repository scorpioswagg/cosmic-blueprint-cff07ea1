import { createFileRoute } from "@tanstack/react-router";
import { Starfield } from "@/components/Starfield";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { ReportsSection } from "@/components/landing/ReportsSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { EmailCaptureSection } from "@/components/landing/EmailCaptureSection";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cosmic Blueprint — Unlock Your Astrological Destiny" },
      { name: "description", content: "Discover your destiny, relationships, and life purpose through precise Swiss Ephemeris astrological analysis. Get your free birth chart today." },
      { property: "og:title", content: "Cosmic Blueprint — Unlock Your Astrological Destiny" },
      { property: "og:description", content: "Discover your destiny, relationships, and life purpose through precise astrological analysis." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="relative min-h-screen bg-background">
      <Starfield />
      <Header />
      <main className="relative z-10">
        <HeroSection />
        <FeaturesSection />
        <ReportsSection />
        <PricingSection />
        <TestimonialsSection />
        <EmailCaptureSection />
      </main>
      <Footer />
    </div>
  );
}
