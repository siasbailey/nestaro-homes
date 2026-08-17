import Navbar from "@/components/Navbar";
import AnnouncementBar from "@/components/AnnouncementBar";
import WhatsAppChat from "@/components/WhatsAppChat";
import HeroSection from "@/sections/HeroSection";
import PrimaryActions from "@/sections/PrimaryActions";
import CatalogSection from "@/sections/CatalogSection";
import StatsBar from "@/sections/StatsBar";
import TrustBanner from "@/sections/TrustBanner";
import FeaturesSection from "@/sections/FeaturesSection";
import TestimonialsSection from "@/sections/TestimonialsSection";
import DeliverySection from "@/sections/DeliverySection";
import ContactSection from "@/sections/ContactSection";
import TeamSection from "@/sections/TeamSection";
import Footer from "@/sections/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <AnnouncementBar />
      <main>
        {/* 1. Hero / Nestaro Homes introduction */}
        <HeroSection />
        {/* 2. Intro write-up + 3. Primary action area (Invest Now / Buy / Mortgage) */}
        <PrimaryActions />
        {/* 4. Tiny-home catalog — immediately after the three options */}
        <CatalogSection />
        {/* 5. Everything else comes after the catalog */}
        <StatsBar />
        <TrustBanner />
        <FeaturesSection />
        <TestimonialsSection />
        <TeamSection />
        <DeliverySection />
        <ContactSection />
      </main>
      <Footer />
      <WhatsAppChat />
    </div>
  );
}
