import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { formatCurrency } from "@/hooks/use-investor";

interface ProjectDisplay {
  id: number;
  name: string;
  location: string;
  category: string;
  description: string | null;
  image: string | null;
  targetAmount: string;
  raisedAmount: string;
  expectedReturn: number;
  durationMonths: number;
  status: string;
}

const fallbackProjects: ProjectDisplay[] = [
  {
    id: 1,
    name: "Pine Ridge Tiny Home Community",
    location: "Bend, Oregon",
    category: "Tiny Home Community",
    description: "A 24-unit tiny home community in Bend's fast-growing high-desert corridor.",
    image: "/images/home-exterior-1.jpg",
    targetAmount: "250000.00",
    raisedAmount: "187500.00",
    expectedReturn: 42,
    durationMonths: 6,
    status: "funding",
  },
  {
    id: 2,
    name: "Riverbend Tiny Home Park",
    location: "Austin, Texas",
    category: "Tiny Home Park",
    description: "Development of 40 premium tiny home sites across Austin's high-demand metro districts.",
    image: "/images/home-exterior-2.jpg",
    targetAmount: "480000.00",
    raisedAmount: "312000.00",
    expectedReturn: 55,
    durationMonths: 12,
    status: "funding",
  },
  {
    id: 4,
    name: "Lakeshore Eco Tiny Village",
    location: "Truckee, California",
    category: "Eco Tiny Village",
    description: "18 eco tiny homes near Lake Tahoe with strong year-round rental demand.",
    image: "/images/home-exterior-5.jpg",
    targetAmount: "620000.00",
    raisedAmount: "198400.00",
    expectedReturn: 52,
    durationMonths: 12,
    status: "open",
  },
];

export default function InvestProjects() {
  const projectsQuery = trpc.investor.projects.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const projects: ProjectDisplay[] =
    projectsQuery.data && projectsQuery.data.length > 0
      ? (projectsQuery.data as ProjectDisplay[])
      : fallbackProjects;

  return (
    <section className="py-24 md:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
        <div className="grid grid-cols-12 gap-6 items-end mb-16">
          <div className="col-span-12 lg:col-span-6">
            <p className="nh-label mb-5">Live Opportunities</p>
            <h2 className="nh-display text-4xl md:text-5xl">Current Home Plan Projects</h2>
          </div>
          <div className="col-span-12 lg:col-span-5 lg:col-start-8">
            <p className="text-[#3d5045] leading-relaxed">
              Real communities your plan helps build. Funding progress updates in real time.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-x-8 gap-y-16">
          {projects.slice(0, 3).map((project) => {
            const target = Number(project.targetAmount);
            const raised = Number(project.raisedAmount);
            const pct = target > 0 ? Math.min(Math.round((raised / target) * 100), 100) : 0;
            return (
              <article key={project.id} className="group">
                <div className="relative aspect-[4/3] overflow-hidden bg-[#f3ede4]">
                  <img
                    src={project.image || "/images/home-exterior-1.jpg"}
                    alt={project.name}
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  />
                  <span className="absolute bottom-0 left-0 bg-[#192420] text-white text-[11px] font-medium uppercase tracking-[0.14em] px-3 py-2">
                    {project.category}
                  </span>
                </div>
                <div className="pt-5">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="font-serif text-2xl text-[#192420] leading-snug">{project.name}</h3>
                    <p className="font-serif text-lg text-[#c47a45] whitespace-nowrap">
                      up to {project.expectedReturn}%
                    </p>
                  </div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#3d5045] mt-2">
                    {project.location}
                  </p>
                  <p className="text-sm text-[#3d5045] mt-3 leading-relaxed line-clamp-2">{project.description}</p>

                  <div className="mt-6">
                    <div className="flex justify-between text-[11px] uppercase tracking-[0.14em] text-[#3d5045] mb-3">
                      <span>${formatCurrency(raised).replace(".00", "")} raised</span>
                      <span className="text-[#192420]">{pct}%</span>
                    </div>
                    <div className="h-px bg-[#e0b48c] overflow-hidden">
                      <div
                        className="h-full bg-[#c47a45] transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[11px] uppercase tracking-[0.14em] text-[#9ca3af] mt-3">
                      <span>Target ${formatCurrency(target).replace(".00", "")}</span>
                      <span>{project.durationMonths} months</span>
                    </div>
                  </div>

                  <Link to="/invest/register" className="nh-link mt-6 inline-flex">
                    Back This Project <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
