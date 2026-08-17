import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const steps = [
  { num: "01", title: "Purchase & Verification", desc: "Choose your home and buy outright or explore financing. Our team verifies your payment and issues your purchase agreement." },
  { num: "02", title: "Documentation", desc: "Our team prepares your contracts, schedules your build, and processes your purchase documents." },
  { num: "03", title: "Final Inspection", desc: "A final inspection of your home is scheduled — walk through your tiny home with our team before delivery." },
  { num: "04", title: "Delivery", desc: "Your home is delivered and set up at your site. Welcome home." },
];

const coverage = [
  { title: "Portland, Oregon — Our Home", desc: "Headquartered in Portland, Oregon, with delivery coordinated across the continental United States." },
  { title: "Serving the US & Europe", desc: "Customers across the United States and Europe are welcome — our team supports remote purchases, documentation, and delivery." },
];

export default function DeliverySection() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  const handleTrack = () => {
    if (!orderNumber || !email) {
      toast.error("Please enter both order number and email");
      return;
    }
    // SPA navigation keeps browser history intact (Back returns here)
    navigate(`/track-order?order=${encodeURIComponent(orderNumber)}&email=${encodeURIComponent(email)}`);
  };

  return (
    <section id="delivery" className="py-24 md:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
        <div className="grid lg:grid-cols-12 gap-10 mb-16 md:mb-24">
          <div className="lg:col-span-6">
            <p className="nh-label mb-6">The Process</p>
            <h2 className="nh-display text-4xl md:text-5xl">
              From first enquiry<br />to delivery day
            </h2>
          </div>
          <div className="lg:col-span-5 lg:col-start-8 flex items-end">
            <p className="text-lg text-[#3d5045] leading-relaxed">
              A transparent, fully documented purchase journey — you are notified by email
              at every stage.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-16 items-start">
          {/* Process — numbered editorial rows */}
          <div className="lg:col-span-7">
            {steps.map((step, i) => (
              <div
                key={step.num}
                className={`flex gap-8 py-8 ${i > 0 ? "border-t border-[#e5e7eb]" : ""}`}
              >
                <span className="font-serif text-sm text-[#9ca3af] tracking-widest pt-1 shrink-0">{step.num}</span>
                <div>
                  <h3 className="font-serif text-2xl text-[#26342b]">{step.title}</h3>
                  <p className="text-[#3d5045] leading-relaxed mt-3 max-w-lg">{step.desc}</p>
                </div>
              </div>
            ))}

            {/* Coverage */}
            <div className="grid sm:grid-cols-2 gap-10 mt-12 pt-12 border-t border-[#e5e7eb]">
              {coverage.map((c) => (
                <div key={c.title}>
                  <h4 className="font-serif text-lg text-[#26342b] mb-2">{c.title}</h4>
                  <p className="text-sm text-[#3d5045] leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Track purchase — one deliberate dark panel */}
          <div className="lg:col-span-5 bg-[#192420] text-white p-10 md:p-12">
            <h3 className="font-serif text-3xl mb-3">Track Your Purchase</h3>
            <p className="text-sm text-white/60 leading-relaxed mb-10">
              Enter your order reference and email to follow every stage.
            </p>
            <div className="space-y-8">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.2em] text-white/50 mb-3">Order Number</label>
                <Input
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="NH-US-2026-XXXXX"
                  className="bg-transparent border-0 border-b border-white/25 rounded-none text-white placeholder:text-white/30 px-0 focus-visible:ring-0 focus-visible:border-[#c47a45]"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.2em] text-white/50 mb-3">Email Address</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="bg-transparent border-0 border-b border-white/25 rounded-none text-white placeholder:text-white/30 px-0 focus-visible:ring-0 focus-visible:border-[#c47a45]"
                />
              </div>
              <button
                onClick={handleTrack}
                className="w-full bg-[#c47a45] text-white py-4 text-sm font-medium tracking-wide hover:bg-[#a6632f] transition-colors inline-flex items-center justify-center gap-2"
              >
                Track Purchase
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-xs text-white/40 text-center">
                Or{" "}
                <Link to="/track-order" className="text-[#c47a45] hover:underline">
                  go to the tracking page
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
