import { Link } from "react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";

const facts = [
  { value: "$20K", label: "Starting price" },
  { value: "$190K", label: "Upper range" },
  { value: "33", label: "Countries served" },
  { value: "24h", label: "Always open" },
];

export default function HeroSection() {
  return (
    <section id="home" className="relative bg-[#f7f4ee]">
      {/* Split composition — content left, photography right */}
      <div className="grid lg:grid-cols-2 min-h-screen">
        {/* Left: content panel */}
        <div className="flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-24 pt-32 pb-16 lg:py-0 order-2 lg:order-1">
          <p className="nh-label mb-8">Nestaro Homes — Portland, Oregon</p>

          <h1 className="nh-display text-5xl md:text-6xl xl:text-7xl">
            Premium Tiny Homes,
            <br />
            <span className="text-[#c47a45]">Designed for Modern Living</span>
          </h1>

          <hr className="nh-rule w-16 my-10" />

          <p className="text-lg text-[#3d5045] max-w-md leading-relaxed">
            Thoughtfully crafted homes from $20,000 to $190,000, built in the Pacific
            Northwest and delivered across the United States &amp; Europe.
          </p>

          <div className="flex flex-wrap items-center gap-x-10 gap-y-4 mt-12">
            <a
              href="#catalog"
              className="inline-flex items-center gap-2 bg-[#26342b] text-white px-8 py-4 text-sm font-medium tracking-wide hover:bg-[#192420] transition-colors"
            >
              Explore Homes
              <ArrowRight className="w-4 h-4" />
            </a>
            <a href="#get-started" className="nh-link text-sm tracking-wide">
              Get Started
              <ArrowUpRight className="w-4 h-4" />
            </a>
            <Link to="/invest" className="nh-link text-sm tracking-wide text-[#c47a45]">
              Invest Now
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Right: full-bleed photography */}
        <div className="relative h-72 sm:h-96 lg:h-auto order-1 lg:order-2">
          <img
            src="/images/hero-home.jpg"
            alt="Nestaro tiny home exterior"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Quiet caption chip */}
          <div className="absolute bottom-6 left-6 bg-[#f7f4ee]/95 px-5 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#3d5045]">Featured model</p>
            <p className="font-serif text-lg text-[#26342b]">The Pacific Loft — $115,000</p>
          </div>
        </div>
      </div>

      {/* Fact strip — figures carried by typography, not cards */}
      <div className="border-t border-[#e5e7eb] bg-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {facts.map((f, i) => (
              <div
                key={f.label}
                className={`py-8 md:py-10 ${i > 0 ? "md:border-l md:border-[#e5e7eb] md:pl-10" : ""}`}
              >
                <p className="font-serif text-3xl md:text-4xl text-[#26342b]">{f.value}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-[#9ca3af] mt-2">{f.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
