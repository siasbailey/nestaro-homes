import { Link } from "react-router";
import Navbar from "@/components/Navbar";
import AnnouncementBar from "@/components/AnnouncementBar";
import Footer from "@/sections/Footer";
import WhatsAppChat from "@/components/WhatsAppChat";

export default function About() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <AnnouncementBar />
      <main className="pt-32 pb-24">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
          {/* Header */}
          <div className="grid grid-cols-12 gap-6 items-end mb-20">
            <div className="col-span-12 lg:col-span-5">
              <p className="nh-label mb-5">About Us</p>
              <h1 className="nh-display text-4xl md:text-6xl">About Nestaro Homes</h1>
            </div>
            <div className="col-span-12 lg:col-span-6 lg:col-start-7">
              <p className="text-[#3d5045] text-lg leading-relaxed">
                Pacific Northwest craftsmanship, transatlantic reach.
              </p>
            </div>
          </div>

          {/* Story */}
          <div className="grid grid-cols-12 gap-6 border-t border-[#e5e7eb] pt-14 mb-20">
            <div className="col-span-12 lg:col-span-4">
              <p className="nh-label">Our Story</p>
            </div>
            <div className="col-span-12 lg:col-span-7 lg:col-start-6 space-y-5">
              <p className="text-[#3d5045] leading-relaxed text-lg">
                Nestaro Homes was founded in Portland, Oregon with a simple mission: make exceptional tiny homes
                accessible to everyone, everywhere. We recognized that finding a premium small home with transparent
                pricing and documentation was far too difficult, and we set out to create a better solution.
              </p>
              <p className="text-[#3d5045] leading-relaxed">
                From our first workshop in Portland, we have grown into a leading premium tiny-home company,
                serving customers across the United States & Europe. Every home is built with premium materials,
                rigorous construction standards, and a commitment to quality that is unmatched in the industry.
              </p>
            </div>
          </div>

          {/* Mission / Vision / Values */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-t border-l border-[#e5e7eb] mb-20">
            {[
              {
                n: "01",
                t: "Our Mission",
                d: "To craft exceptional tiny homes that improve lives and make modern, sustainable living attainable.",
              },
              {
                n: "02",
                t: "Our Vision",
                d: "To become the most trusted name in premium tiny homes, known for quality, integrity, and innovation.",
              },
              {
                n: "03",
                t: "Our Values",
                d: "Quality, integrity, customer-first approach, and sustainable building practices.",
              },
            ].map((item) => (
              <div key={item.n} className="border-b border-r border-[#e5e7eb] p-8 lg:p-10">
                <p className="font-serif text-sm text-[#c47a45] mb-6">{item.n}</p>
                <h3 className="font-serif text-2xl text-[#192420] mb-3">{item.t}</h3>
                <p className="text-sm text-[#3d5045] leading-relaxed">{item.d}</p>
              </div>
            ))}
          </div>

          {/* Why choose us */}
          <div className="bg-[#192420] text-white p-8 sm:p-12 lg:p-16 mb-20">
            <p className="nh-label mb-10">Why Choose Us</p>
            <div className="grid md:grid-cols-2 gap-x-12 gap-y-10">
              {[
                {
                  t: "American Craftsmanship",
                  d: "All homes are built in Portland, Oregon using premium materials and rigorous construction standards.",
                },
                {
                  t: "Full Documentation",
                  d: "Every home ships with complete certification and documentation handled by our team.",
                },
                {
                  t: "Transparent Pricing",
                  d: "No hidden fees. The price you see is the price you pay — documentation and delivery coordination included.",
                },
                {
                  t: "Flexible Payments",
                  d: "Buy outright or explore flexible financing — pay a deposit and spread the balance in installments.",
                },
              ].map((item, i) => (
                <div key={item.t} className="border-t border-white/15 pt-6">
                  <p className="font-serif text-sm text-[#c47a45] mb-3">0{i + 1}</p>
                  <h4 className="font-serif text-xl mb-2">{item.t}</h4>
                  <p className="text-white/60 text-sm leading-relaxed">{item.d}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="border-t border-[#e5e7eb] pt-14 text-center">
            <h2 className="nh-display text-3xl md:text-4xl mb-4">Ready to Get Started?</h2>
            <p className="text-[#3d5045] mb-8">Browse our homes and find your perfect tiny home today.</p>
            <Link
              to="/#catalog"
              className="inline-flex items-center gap-3 bg-[#26342b] text-white px-8 py-4 text-[13px] font-medium uppercase tracking-[0.14em] hover:bg-[#192420] transition-colors"
            >
              Explore Homes
            </Link>
          </div>
        </div>
      </main>
      <Footer />
      <WhatsAppChat />
    </div>
  );
}
