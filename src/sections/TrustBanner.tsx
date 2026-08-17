export default function TrustBanner() {
  const items = [
    { title: "Portland, Oregon", desc: "Headquartered in the Pacific Northwest" },
    { title: "US & Europe", desc: "Delivery coordinated across 33 countries" },
    { title: "Open 24 Hours", desc: "Our team is always available" },
  ];

  return (
    <section className="py-14 bg-[#f7f4ee] border-y border-[#e5e7eb]">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
        <div className="grid md:grid-cols-3 gap-10 md:gap-0">
          {items.map((item, i) => (
            <div
              key={item.title}
              className={`${i > 0 ? "md:border-l md:border-[#e5e7eb] md:pl-10" : ""}`}
            >
              <p className="font-serif text-xl text-[#26342b]">{item.title}</p>
              <p className="text-sm text-[#3d5045] mt-1.5">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
