import { trpc } from "@/providers/trpc";

// Original hardcoded roster — used only when no team members are stored in
// the database yet (or the query is unavailable), so the section always renders.
const FALLBACK_TEAM = [
  {
    name: "Sarah Mitchell",
    role: "CEO & Founder",
    image: "/images/agent-hero.png",
    bio: "With over 15 years in home design and construction, Sarah founded Nestaro Homes to make premium tiny living accessible across the US & Europe.",
  },
  {
    name: "James Cooper",
    role: "Head of Operations",
    image: "/images/50 years old ceo 2.jpg",
    bio: "James oversees our Portland workshop, ensuring every home meets our strict quality standards before delivery.",
  },
  {
    name: "Elena Rodriguez",
    role: "Client Relations Manager",
    image: "/images/woman ceo.jpg",
    bio: "Based in Portland, Elena supports our customers across the US and Europe — from first enquiry to documentation and delivery.",
  },
  {
    name: "David Kim",
    role: "Customer Success Lead",
    image: "/images/51 years old ceo 1.jpg",
    bio: "David and his team provide 24-hour support to our customers, from initial inquiry through documentation, delivery, and beyond.",
  },
];

export default function TeamSection() {
  const { data: members } = trpc.products.teamMembers.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });

  const team =
    members && members.length > 0
      ? members.map((m) => ({
          name: m.name,
          role: m.role,
          image: m.photo || "/images/agent-hero.png",
          bio: m.bio ?? "",
        }))
      : FALLBACK_TEAM;

  return (
    <section className="py-24 md:py-32 bg-[#f7f4ee]">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
        <div className="grid lg:grid-cols-12 gap-10 mb-16 md:mb-24">
          <div className="lg:col-span-5">
            <p className="nh-label mb-6">Our Team</p>
            <h2 className="nh-display text-4xl md:text-5xl">The people behind the homes</h2>
          </div>
          <div className="lg:col-span-6 lg:col-start-7 flex items-end">
            <p className="text-lg text-[#3d5045] leading-relaxed">
              Dedicated professionals committed to delivering your dream tiny home with excellence.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-14">
          {team.map((member) => (
            <div key={member.name} className="group">
              <div className="aspect-[3/4] overflow-hidden bg-[#f3ede4]">
                <img
                  src={member.image}
                  alt={member.name}
                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                />
              </div>
              <h3 className="font-serif text-xl text-[#26342b] mt-6">{member.name}</h3>
              <p className="text-xs uppercase tracking-[0.18em] text-[#c47a45] mt-1.5">{member.role}</p>
              <p className="text-sm text-[#3d5045] leading-relaxed mt-4">{member.bio}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
