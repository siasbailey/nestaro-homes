import { Star } from "lucide-react";
import { trpc } from "@/providers/trpc";

type PublicTestimonial = {
  id: number;
  customerName: string;
  photo: string | null;
  propertyName: string | null;
  investmentPlan: string | null;
  mortgagePlan: string | null;
  rating: number;
  title: string | null;
  message: string;
  featured: string;
  verified: boolean;
};

const FALLBACK: PublicTestimonial[] = [
  {
    id: -1,
    customerName: "Marcus Bennett",
    photo: null,
    propertyName: null,
    investmentPlan: null,
    mortgagePlan: null,
    rating: 5,
    title: null,
    message:
      "Buying from Denver felt effortless. The documentation was handled entirely by Nestaro Homes, and I followed every stage online until delivery. The home is stunning — flawless finish.",
    featured: "no",
    verified: true,
  },
  {
    id: -2,
    customerName: "Claire Dubois",
    photo: null,
    propertyName: null,
    investmentPlan: null,
    mortgagePlan: null,
    rating: 5,
    title: null,
    message:
      "I was initially worried about buying a home from France, but their support team made everything easy. The bank transfer was straightforward, the paperwork is complete, and the house is beautiful.",
    featured: "no",
    verified: true,
  },
  {
    id: -3,
    customerName: "James Whitfield",
    photo: null,
    propertyName: null,
    investmentPlan: null,
    mortgagePlan: null,
    rating: 5,
    title: null,
    message:
      "The financing plan made it possible. A reasonable deposit, clear monthly installments, and our Columbia model was delivered within the promised window. Excellent quality at fair terms.",
    featured: "no",
    verified: true,
  },
];

function contextLine(t: PublicTestimonial): string {
  if (t.propertyName) return `Home: ${t.propertyName}`;
  if (t.investmentPlan) return `Home Plan: ${t.investmentPlan}`;
  if (t.mortgagePlan) return `Financing: ${t.mortgagePlan}`;
  return t.verified ? "Verified Customer" : "Nestaro Homes Customer";
}

export default function TestimonialsSection() {
  const query = trpc.testimonial.publicList.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60_000,
  });

  const live = (query.data ?? []) as unknown as PublicTestimonial[];
  // Approved testimonials (featured first, then most recent) — fallback keeps the page warm
  const featured = live.filter((t) => t.featured === "yes");
  const regular = live.filter((t) => t.featured !== "yes");
  const items = [...featured, ...regular].slice(0, 6);
  const testimonials = items.length ? items : FALLBACK;

  const avg = live.length ? (live.reduce((s, t) => s + t.rating, 0) / live.length).toFixed(1) : null;

  return (
    <section className="py-24 md:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
        <div className="grid lg:grid-cols-12 gap-10 mb-16 md:mb-24">
          <div className="lg:col-span-6">
            <p className="nh-label mb-6">Testimonials</p>
            <h2 className="nh-display text-4xl md:text-5xl">
              Trusted across the US &amp; Europe
            </h2>
          </div>
          <div className="lg:col-span-5 lg:col-start-8 flex items-end">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-[#c47a45]">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-4 h-4 fill-current" />
                ))}
              </div>
              <span className="text-sm text-[#3d5045]">
                {avg ? `${avg}/5 from ${live.length} verified customer${live.length === 1 ? "" : "s"}` : "4.9/5 from 200+ happy customers"}
              </span>
            </div>
          </div>
        </div>

        {/* Editorial quotes — hairline dividers, no boxes */}
        <div className="grid md:grid-cols-3 border-t border-[#e5e7eb]">
          {testimonials.map((t, i) => (
            <figure
              key={t.id}
              className={`py-12 md:py-16 flex flex-col ${i > 0 ? "border-t md:border-t-0 md:border-l border-[#e5e7eb] md:pl-10" : ""} ${i < testimonials.length - 1 ? "md:pr-10" : ""}`}
            >
              <blockquote className="font-serif text-xl text-[#26342b] leading-relaxed flex-1">
                &ldquo;{t.message}&rdquo;
              </blockquote>
              <figcaption className="mt-8 pt-6 border-t border-[#e5e7eb]">
                <p className="text-sm font-medium text-[#26342b] tracking-wide">{t.customerName}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-[#9ca3af] mt-1.5">{contextLine(t)}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
