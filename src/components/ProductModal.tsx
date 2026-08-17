import { useState } from "react";
import { useNavigate } from "react-router";
import { X, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import BookAppointmentModal from "@/components/crm/BookAppointmentModal";

interface ProductModalProps {
  product: any;
  onClose: () => void;
  onAddToCart: (product: any) => void;
}

export default function ProductModal({ product, onClose, onAddToCart }: ProductModalProps) {
  const navigate = useNavigate();
  const [mainImage, setMainImage] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);

  const images = typeof product.images === "string" ? JSON.parse(product.images) : product.images;
  const specs = typeof product.specs === "string" ? JSON.parse(product.specs) : product.specs;
  const features = typeof product.features === "string" ? JSON.parse(product.features) : product.features;
  const imageList = Array.isArray(images) ? images : ["/images/home-exterior-1.jpg"];
  const specEntries = specs && typeof specs === "object" ? Object.entries(specs) : [];
  const featureList = Array.isArray(features) ? features : [];

  const faqs = [
    { q: "Is the home certified?", a: "Yes. Every Nestaro tiny home ships with complete certification documentation. Our team handles the full documentation process on your behalf." },
    { q: "Can I view the home before buying?", a: "Absolutely. We encourage viewings — book an appointment with our consultants and a final inspection is always scheduled before delivery." },
    { q: "Can I buy with financing?", a: "Yes — eligible homes can be purchased with a Nestaro Homes financing plan. Pay a deposit and spread the balance in monthly or yearly installments." },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 bg-white/90 hover:bg-white flex items-center justify-center z-10 transition"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-[#26342b]" />
        </button>

        <div className="grid lg:grid-cols-2">
          {/* Left: gallery — the photograph carries the design */}
          <div className="lg:sticky lg:top-0 self-start">
            <div className="relative aspect-[4/3] bg-[#f3ede4]">
              <img src={imageList[mainImage]} className="w-full h-full object-cover" alt={product.name} />
            </div>
            <div className="grid grid-cols-4 border-t border-[#e5e7eb]">
              {imageList.slice(0, 4).map((img: string, i: number) => (
                <button
                  key={i}
                  onClick={() => setMainImage(i)}
                  className={`relative aspect-[4/3] overflow-hidden ${i === mainImage ? "outline outline-2 outline-[#26342b] outline-offset-[-2px]" : "opacity-70 hover:opacity-100"}`}
                  aria-label={`View ${i + 1}`}
                >
                  <img src={img} className="w-full h-full object-cover" alt={`${product.name} view ${i + 1}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Right: details */}
          <div className="p-8 lg:p-12 lg:border-l lg:border-[#e5e7eb]">
            <p className="nh-label mb-4">{product.bedrooms} BR · {product.bathrooms} BA · {product.size}</p>
            <div className="flex flex-wrap justify-between items-end gap-4 pb-8 border-b border-[#e5e7eb]">
              <h2 className="nh-display text-4xl">{product.name}</h2>
              <p className="font-serif text-3xl text-[#c47a45]">${Number(product.price).toLocaleString()}</p>
            </div>

            <dl className="py-8 border-b border-[#e5e7eb] space-y-4">
              <div className="flex justify-between text-sm">
                <dt className="uppercase tracking-[0.16em] text-[#9ca3af]">Delivery</dt>
                <dd className="text-[#26342b] font-medium text-right">{product.delivery}</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="uppercase tracking-[0.16em] text-[#9ca3af]">Warranty</dt>
                <dd className="text-[#26342b] font-medium text-right">{product.warranty}</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="uppercase tracking-[0.16em] text-[#9ca3af]">Built in</dt>
                <dd className="text-[#26342b] font-medium text-right">Portland, Oregon, USA</dd>
              </div>
            </dl>

            {featureList.length > 0 && (
              <div className="py-8 border-b border-[#e5e7eb]">
                <h3 className="nh-label mb-5">Key Features</h3>
                <ul className="space-y-2.5">
                  {featureList.map((f: string) => (
                    <li key={f} className="text-sm text-[#3d5045] leading-relaxed flex gap-3">
                      <span className="w-4 h-px bg-[#c47a45] mt-2.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {specEntries.length > 0 && (
              <div className="py-8 border-b border-[#e5e7eb]">
                <h3 className="nh-label mb-5">Specifications</h3>
                <dl>
                  {specEntries.map(([key, val]: [string, any]) => (
                    <div key={key} className="flex justify-between gap-6 py-2.5 border-b border-[#f3ede4] last:border-0 text-sm">
                      <dt className="text-[#9ca3af]">{key}</dt>
                      <dd className="font-medium text-[#26342b] text-right">{String(val)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* FAQ */}
            <div className="py-8 border-b border-[#e5e7eb]">
              <h3 className="nh-label mb-4">Questions</h3>
              <div>
                {faqs.map((faq, i) => (
                  <div key={i} className="border-b border-[#f3ede4] last:border-0">
                    <button
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="w-full flex justify-between items-center py-3.5 text-left"
                    >
                      <span className="font-medium text-sm text-[#26342b]">{faq.q}</span>
                      {openFaq === i ? <ChevronUp className="w-4 h-4 text-[#9ca3af]" /> : <ChevronDown className="w-4 h-4 text-[#9ca3af]" />}
                    </button>
                    {openFaq === i && (
                      <p className="text-sm text-[#3d5045] leading-relaxed pb-4">{faq.a}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions — one primary, two restrained */}
            <div className="pt-8 space-y-3">
              <button
                onClick={() => { onAddToCart(product); onClose(); }}
                className="w-full bg-[#26342b] text-white py-4 text-sm font-medium tracking-wide hover:bg-[#192420] transition-colors inline-flex items-center justify-center gap-2"
              >
                Buy Outright — ${Number(product.price).toLocaleString()}
                <ArrowRight className="w-4 h-4" />
              </button>
              {product.mortgageEnabled === "yes" && (
                <button
                  onClick={() => {
                    onClose();
                    navigate(`/mortgage/apply/${product.id}`);
                  }}
                  className="w-full border border-[#26342b] text-[#26342b] py-4 text-sm font-medium tracking-wide hover:bg-[#26342b] hover:text-white transition-colors"
                >
                  Get Financing
                </button>
              )}
              <button
                onClick={() => setBookingOpen(true)}
                className="w-full text-center nh-link justify-center text-sm tracking-wide py-2"
              >
                Book a Viewing
              </button>
            </div>

            <p className="text-xs text-[#9ca3af] mt-6 text-center tracking-wide">
              SSL secure · 14-day cancellation · Portland, Oregon
            </p>
          </div>
        </div>
      </div>

      {bookingOpen && (
        <BookAppointmentModal
          onClose={() => setBookingOpen(false)}
          productId={product.id}
          propertyName={product.name}
          defaultType="property_inspection"
        />
      )}
    </div>
  );
}
