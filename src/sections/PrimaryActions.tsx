import { Link } from "react-router";
import { ArrowRight } from "lucide-react";

const pathways = [
  {
    num: "01",
    title: "Invest Now",
    desc: "Home plans that build credit toward your tiny home, starting from just $1,000. Transparent terms, tracked in real time.",
    cta: "Explore Investment",
    href: "/invest",
    external: false,
  },
  {
    num: "02",
    title: "Buy",
    desc: "Eight considered models from $20,000 to $190,000, built to order and delivered to your site.",
    cta: "Explore Homes",
    href: "#catalog",
    external: true,
  },
  {
    num: "03",
    title: "Mortgage",
    desc: "Flexible financing that lets you spread the cost of your home over time — a deposit, then simple installments.",
    cta: "Explore Financing",
    href: "/mortgage",
    external: false,
  },
];

export default function PrimaryActions() {
  return (
    <section id="get-started" className="py-24 md:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
        {/* Introduction */}
        <div className="grid lg:grid-cols-12 gap-10 mb-20 md:mb-28">
          <div className="lg:col-span-5">
            <p className="nh-label mb-6">Welcome to Nestaro Homes</p>
            <h2 className="nh-display text-4xl md:text-5xl">
              Three ways to make it yours
            </h2>
          </div>
          <div className="lg:col-span-6 lg:col-start-7 flex items-end">
            <p className="text-lg text-[#3d5045] leading-relaxed">
              Nestaro Homes designs and builds premium tiny homes in Portland, Oregon for
              modern living across the United States &amp; Europe. Whether you invest in a
              home plan, buy outright, or finance over time — your path starts here.
            </p>
          </div>
        </div>

        {/* Three pathways — editorial panels separated by hairlines, not cards */}
        <div className="grid md:grid-cols-3 border-t border-b border-[#e5e7eb]">
          {pathways.map((p, i) => {
            const inner = (
              <>
                <div className="flex items-baseline justify-between mb-10">
                  <span className="font-serif text-sm text-[#9ca3af] tracking-widest">{p.num}</span>
                  <ArrowRight className="w-5 h-5 text-[#c47a45] transition-transform duration-300 group-hover:translate-x-2" />
                </div>
                <h3 className="font-serif text-3xl md:text-4xl text-[#26342b] mb-5 group-hover:text-[#c47a45] transition-colors">
                  {p.title}
                </h3>
                <p className="text-[#3d5045] leading-relaxed mb-8">{p.desc}</p>
                <span className="nh-link text-sm tracking-wide">{p.cta}</span>
              </>
            );
            const cls = `group block py-12 md:py-16 px-2 md:px-10 ${
              i > 0 ? "border-t md:border-t-0 md:border-l border-[#e5e7eb]" : ""
            }`;
            return p.external ? (
              <a key={p.title} href={p.href} className={cls}>
                {inner}
              </a>
            ) : (
              <Link key={p.title} to={p.href} className={cls}>
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
