import { useEffect } from "react";
import { useLocation } from "react-router";
import Navbar from "@/components/Navbar";
import AnnouncementBar from "@/components/AnnouncementBar";
import Footer from "@/sections/Footer";
import WhatsAppChat from "@/components/WhatsAppChat";
import InvestHero from "@/sections/invest/InvestHero";
import InvestPlans from "@/sections/invest/InvestPlans";
import InvestBenefits from "@/sections/invest/InvestBenefits";
import InvestCalculator from "@/sections/invest/InvestCalculator";
import InvestProjects from "@/sections/invest/InvestProjects";
import InvestFAQ from "@/sections/invest/InvestFAQ";

export default function InvestHome() {
  const location = useLocation();

  // Scroll to anchored sections (e.g. /invest#invest-plans from the navbar dropdown)
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.replace("#", "");
    // Wait a tick so sections have rendered
    const t = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(t);
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <AnnouncementBar />
      <main>
        <InvestHero />
        <InvestPlans />
        <InvestBenefits />
        <InvestProjects />
        <InvestCalculator />
        <InvestFAQ />
      </main>
      <Footer />
      <WhatsAppChat />
    </div>
  );
}
