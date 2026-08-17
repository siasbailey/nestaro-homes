import { Link } from "react-router";
import { ArrowRight } from "lucide-react";

const heroStats = [
  { value: "$4.2M+", label: "Plans Funded" },
  { value: "1,800+", label: "Plan Members" },
  { value: "Up to 70%", label: "Target Home Credit" },
  { value: "33", label: "Countries Served" },
];

export default function InvestHero() {
  const scrollToPlans = () => {
    document.getElementById("invest-plans")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="bg-[#f7f4ee]">
      <div className="grid lg:grid-cols-2 min-h-screen">
        {/* Left: content panel */}
        <div className="order-2 lg:order-1 flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-24 pt-32 pb-16 lg:py-0">
          <p className="nh-label mb-6">Nestaro Home Plans</p>
          <h1 className="nh-display text-5xl md:text-6xl xl:text-7xl">
            Plan Your Tiny Home.{" "}
            <span className="text-[#c47a45]">Build Toward It with Confidence.</span>
          </h1>
          <div className="nh-rule w-16 my-8" />
          <p className="text-lg text-[#3d5045] max-w-md leading-relaxed">
            Join thousands of customers building toward their tiny home with Nestaro Home
            Plans — starting from just $1,000.
          </p>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4 mt-10">
            <Link
              to="/invest/register"
              className="inline-flex items-center gap-3 bg-[#26342b] text-white px-8 py-4 text-[13px] font-medium uppercase tracking-[0.14em] hover:bg-[#192420] transition-colors"
            >
              Start Your Plan
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button onClick={scrollToPlans} className="nh-link">
              View Plans <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: photo + funding panel */}
        <div className="order-1 lg:order-2 relative min-h-[55vh] lg:min-h-screen">
          <img
            src="/images/home-exterior-4.jpg"
            alt="Nestaro tiny home exterior"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute bottom-0 left-0 right-0 lg:left-12 bg-[#192420]/95 text-white p-7 lg:p-9 lg:max-w-md">
            <p className="nh-label mb-6">Plan Performance</p>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-4">
              <p className="font-serif text-xl min-w-0 break-words">Austin ADU Expansion Program</p>
              <p className="font-serif text-[#c47a45] whitespace-nowrap shrink-0">65% funded</p>
            </div>
            <div className="h-px bg-white/20 overflow-hidden">
              <div className="h-full w-[65%] bg-[#c47a45]"></div>
            </div>
            <p className="text-xs text-white/50 mt-4">
              $312,000 raised of $480,000 target · Expected home credit up to 55%
            </p>
          </div>
        </div>
      </div>

      {/* Fact strip */}
      <div className="border-t border-[#e5e7eb] bg-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {heroStats.map((stat) => (
            <div key={stat.label} className="min-w-0 md:border-l md:border-[#e5e7eb] md:first:border-l-0 md:pl-10 md:first:pl-0">
              <p className="font-serif text-3xl md:text-4xl text-[#192420] [overflow-wrap:anywhere]">{stat.value}</p>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#3d5045] mt-2 break-words">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
