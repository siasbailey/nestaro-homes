import { Link } from "react-router";

const columns = [
  {
    heading: "Homes",
    links: [
      { label: "Studio Models", href: "/#catalog" },
      { label: "One-Bedroom Models", href: "/#catalog" },
      { label: "Two-Bedroom Models", href: "/#catalog" },
      { label: "Family Models", href: "/#catalog" },
      { label: "Financing", href: "/mortgage" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Home Plans Portal", href: "/invest" },
      { label: "FAQ", href: "/faq" },
      { label: "Track Purchase", href: "/track-order" },
      { label: "Contact", href: "/#contact" },
      { label: "Admin Portal", href: "/admin" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "Terms of Service", href: "/terms-conditions" },
      { label: "Refund Policy", href: "/terms-conditions" },
      { label: "Cookie Policy", href: "/privacy-policy" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-[#192420] text-white">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
        {/* Top: brand statement + columns */}
        <div className="grid lg:grid-cols-12 gap-14 py-20 md:py-28">
          <div className="lg:col-span-5">
            <p className="font-serif text-3xl md:text-4xl uppercase tracking-[0.08em]">Nestaro Homes</p>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#9ca3af] mt-2">Premium Tiny Homes</p>
            <p className="text-white/60 leading-relaxed mt-8 max-w-sm">
              Premium tiny homes designed for modern living. Built in Portland, Oregon —
              serving the United States &amp; Europe.
            </p>
            <div className="mt-10 space-y-2 text-sm text-white/60">
              <p>Portland, Oregon 97209, United States</p>
              <p>info@nestarohomes.com</p>
              <p>+1 (506) 497-8043 · Open 24 hours</p>
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.heading} className="lg:col-span-2">
              <h4 className="text-[11px] uppercase tracking-[0.22em] text-[#9ca3af] mb-6">{col.heading}</h4>
              <ul className="space-y-3.5">
                {col.links.map((l) =>
                  l.href.startsWith("/#") ? (
                    <li key={l.label}>
                      <a href={l.href} className="text-sm text-white/70 hover:text-white transition-colors">
                        {l.label}
                      </a>
                    </li>
                  ) : (
                    <li key={l.label}>
                      <Link to={l.href} className="text-sm text-white/70 hover:text-white transition-colors">
                        {l.label}
                      </Link>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}

          <div className="lg:col-span-1">
            <h4 className="text-[11px] uppercase tracking-[0.22em] text-[#9ca3af] mb-6">Follow</h4>
            <ul className="space-y-3.5">
              <li>
                <a href="https://facebook.com/nestarohomes" target="_blank" rel="noopener noreferrer" className="text-sm text-white/70 hover:text-white transition-colors">
                  Facebook
                </a>
              </li>
              <li>
                <a href="https://instagram.com/nestarohomes" target="_blank" rel="noopener noreferrer" className="text-sm text-white/70 hover:text-white transition-colors">
                  Instagram
                </a>
              </li>
              <li>
                <a href="https://tiktok.com/@nestarohomes" target="_blank" rel="noopener noreferrer" className="text-sm text-white/70 hover:text-white transition-colors">
                  TikTok
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 py-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-white/40 tracking-wide">
            &copy; {new Date().getFullYear()} Nestaro Homes LLC. All rights reserved.
          </p>
          <p className="text-xs text-white/40 tracking-wide">
            Serving the United States &amp; Europe · Open 24 hours
          </p>
        </div>
      </div>
    </footer>
  );
}
