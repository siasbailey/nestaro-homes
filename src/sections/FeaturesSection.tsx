const features = [
  {
    num: "01",
    title: "American Craftsmanship",
    desc: "Every tiny home is built in our Portland workshop to rigorous standards using premium, sustainable materials and finishes.",
  },
  {
    num: "02",
    title: "Thoughtful Design",
    desc: "From compact studios to family-sized models, our homes are designed around real life — smart layouts, full kitchens, and spa-style bathrooms.",
  },
  {
    num: "03",
    title: "Delivery & Setup",
    desc: "Full documentation, coordinated delivery, and a guided setup process — handled end to end by our team.",
  },
];

export default function FeaturesSection() {
  return (
    <section id="about" className="py-24 md:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
        <div className="grid lg:grid-cols-12 gap-10 mb-16 md:mb-24">
          <div className="lg:col-span-5">
            <p className="nh-label mb-6">Why Nestaro</p>
            <h2 className="nh-display text-4xl md:text-5xl">
              Considered homes,<br />built to last
            </h2>
          </div>
          <div className="lg:col-span-6 lg:col-start-7 flex items-end">
            <p className="text-lg text-[#3d5045] leading-relaxed">
              Quality craftsmanship meets considered design. Built in Oregon, trusted
              across the United States &amp; Europe.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 border-t border-[#e5e7eb]">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`py-12 md:py-16 md:pr-10 ${i > 0 ? "border-t md:border-t-0 md:border-l border-[#e5e7eb] md:pl-10" : ""}`}
            >
              <p className="font-serif text-sm text-[#9ca3af] tracking-widest mb-8">{f.num}</p>
              <h3 className="font-serif text-2xl text-[#26342b] mb-4">{f.title}</h3>
              <p className="text-[#3d5045] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
