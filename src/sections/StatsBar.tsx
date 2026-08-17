const figures = [
  { value: "$20,000", label: "Starting price" },
  { value: "$190,000", label: "Upper price range" },
  { value: "$50", label: "Minimum deposit" },
  { value: "$50", label: "Referral reward" },
];

export default function StatsBar() {
  return (
    <section className="bg-[#192420] text-white">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {figures.map((f, i) => (
            <div
              key={f.label}
              className={`min-w-0 py-10 sm:py-12 md:py-16 ${i > 0 ? "md:border-l md:border-white/10 md:pl-10" : ""}`}
            >
              <p className="font-serif text-3xl sm:text-4xl md:text-5xl [overflow-wrap:anywhere]">{f.value}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-[#9ca3af] mt-3 break-words">{f.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
