import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { fallbackPlans, parsePlanFeatures, type PlanDisplay } from "@/lib/investment-plans";
import { formatCurrency } from "@/hooks/use-investor";

export default function InvestPlans() {
  const plansQuery = trpc.investor.plans.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const plans: PlanDisplay[] =
    plansQuery.data && plansQuery.data.length > 0
      ? (plansQuery.data as PlanDisplay[])
      : fallbackPlans;

  return (
    <section id="invest-plans" className="py-24 md:py-32 bg-[#f7f4ee]">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
        <div className="grid grid-cols-12 gap-6 items-end mb-16">
          <div className="col-span-12 lg:col-span-5">
            <p className="nh-label mb-5">Home Plans</p>
            <h2 className="nh-display text-4xl md:text-5xl">Choose Your Path Home</h2>
          </div>
          <div className="col-span-12 lg:col-span-6 lg:col-start-7">
            <p className="text-[#3d5045] leading-relaxed">
              Three carefully structured plans that build credit toward your tiny home. Pick the one that matches your goals.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 border-t border-l border-[#e5e7eb]">
          {plans.map((plan) => {
            const features = parsePlanFeatures(plan.features);
            const featured = plan.featured === "yes";
            return (
              <div
                key={plan.slug}
                className={`relative border-b border-r border-[#e5e7eb] p-8 lg:p-10 flex flex-col ${
                  featured ? "bg-white" : "bg-transparent"
                }`}
              >
                {featured && (
                  <span className="absolute top-0 left-0 bg-[#192420] text-white text-[10px] font-medium uppercase tracking-[0.16em] px-3 py-2">
                    Most Popular
                  </span>
                )}

                <div className={featured ? "mt-8" : ""}>
                  <h3 className="font-serif text-3xl text-[#192420]">{plan.name}</h3>
                  <p className="text-sm text-[#3d5045] mt-3 min-h-[40px] leading-relaxed">{plan.description}</p>
                </div>

                <div className="mt-8 pb-8 border-b border-[#e5e7eb]">
                  <div className="flex items-baseline gap-3">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-[#3d5045]">up to</span>
                    <span className="font-serif text-6xl text-[#c47a45]">
                      {plan.targetReturn}%
                    </span>
                  </div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#3d5045] mt-2">target home credit</p>
                  <div className="flex items-center gap-4 mt-5 text-sm text-[#192420]">
                    <span>Min ${formatCurrency(plan.minAmount).replace(".00", "")}</span>
                    <span className="w-px h-4 bg-[#e0b48c]"></span>
                    <span>{plan.durationMonths} Months</span>
                  </div>
                </div>

                <ul className="space-y-3 mt-8 mb-10 flex-1">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-[#3d5045]">
                      <span className="w-4 h-px bg-[#c47a45] mt-2.5 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  to={`/invest/register?plan=${plan.slug}`}
                  className={`group inline-flex items-center justify-center gap-3 px-8 py-4 text-[13px] font-medium uppercase tracking-[0.14em] transition-colors ${
                    featured
                      ? "bg-[#c47a45] text-white hover:bg-[#a6632f]"
                      : "border border-[#26342b] text-[#26342b] hover:bg-[#26342b] hover:text-white"
                  }`}
                >
                  Start Plan
                  <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                </Link>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-[#9ca3af] mt-10 max-w-3xl leading-relaxed">
          Target home credits are projections based on historical project performance and are not
          guaranteed. All plans carry risk. Please review the risk disclosure below
          before joining a plan.
        </p>
      </div>
    </section>
  );
}
