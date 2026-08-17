import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/providers/trpc";
import { fallbackPlans, type PlanDisplay } from "@/lib/investment-plans";
import { formatCurrency } from "@/hooks/use-investor";

export default function InvestCalculator() {
  const plansQuery = trpc.investor.plans.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const plans: PlanDisplay[] =
    plansQuery.data && plansQuery.data.length > 0
      ? (plansQuery.data as PlanDisplay[])
      : fallbackPlans;

  const [planSlug, setPlanSlug] = useState("premium");
  const selectedPlan = plans.find((p) => p.slug === planSlug) ?? plans[plans.length - 1];
  const min = Number(selectedPlan?.minAmount ?? 1000);

  const [amount, setAmount] = useState(10000);

  const effectiveAmount = Math.max(amount, min);
  const projectedEarnings = useMemo(
    () => (effectiveAmount * (selectedPlan?.targetReturn ?? 0)) / 100,
    [effectiveAmount, selectedPlan],
  );
  const totalValue = effectiveAmount + projectedEarnings;
  const monthlyEarnings = projectedEarnings / (selectedPlan?.durationMonths || 1);

  return (
    <section id="invest-calculator" className="py-24 md:py-32 bg-[#f3ede4]">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
        <div className="grid grid-cols-12 gap-6 items-end mb-16">
          <div className="col-span-12 lg:col-span-5">
            <p className="nh-label mb-5">Home Credit Calculator</p>
            <h2 className="nh-display text-4xl md:text-5xl">
              See What Your Contribution Could Build
            </h2>
          </div>
          <div className="col-span-12 lg:col-span-6 lg:col-start-7">
            <p className="text-[#3d5045] leading-relaxed">
              Choose a home plan and adjust the amount to project your potential home credits over the plan term.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left: controls */}
          <div className="space-y-10 min-w-0">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#3d5045] mb-4">
                Select a Plan
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {plans.map((plan) => (
                  <button
                    key={plan.slug}
                    onClick={() => {
                      setPlanSlug(plan.slug);
                      setAmount((prev) => Math.max(prev, Number(plan.minAmount)));
                    }}
                    className={`p-5 border text-left transition-colors duration-300 ${
                      selectedPlan?.slug === plan.slug
                        ? "border-[#26342b] bg-white"
                        : "border-[#e0b48c] bg-transparent hover:border-[#26342b]"
                    }`}
                  >
                    <p className="font-serif text-lg text-[#192420]">{plan.name}</p>
                    <p className="font-serif text-2xl text-[#c47a45] mt-1">
                      {plan.targetReturn}%
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#3d5045] mt-2">
                      target · {plan.durationMonths} mo
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-[#e0b48c] pt-8">
              <div className="flex flex-wrap justify-between items-baseline gap-x-3 gap-y-1 mb-6">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#3d5045]">
                  Plan Amount
                </p>
                <span className="font-serif text-2xl sm:text-3xl text-[#192420] [overflow-wrap:anywhere]">
                  ${formatCurrency(effectiveAmount).replace(".00", "")}
                </span>
              </div>
              <Slider
                value={[effectiveAmount]}
                min={min}
                max={100000}
                step={500}
                onValueChange={([v]) => setAmount(v)}
                className="my-4"
              />
              <div className="flex justify-between text-[11px] uppercase tracking-[0.14em] text-[#3d5045] mt-3">
                <span>${formatCurrency(min).replace(".00", "")} min</span>
                <span>$100,000</span>
              </div>
            </div>
          </div>

          {/* Right: results */}
          <div className="bg-[#192420] text-white p-6 sm:p-8 lg:p-12 min-w-0">
            <p className="nh-label mb-8">Projected Home Credits</p>

            <div className="space-y-5">
              <div className="flex flex-wrap justify-between items-baseline gap-x-3 gap-y-1 pb-4 border-b border-white/15">
                <span className="text-white/60 text-sm">Selected Plan</span>
                <span className="font-serif text-lg text-right [overflow-wrap:anywhere]">
                  {selectedPlan?.name} · {selectedPlan?.durationMonths} months
                </span>
              </div>
              <div className="flex flex-wrap justify-between items-baseline gap-x-3 gap-y-1 pb-4 border-b border-white/15">
                <span className="text-white/60 text-sm">Your Plan</span>
                <span className="font-serif text-lg [overflow-wrap:anywhere]">${formatCurrency(effectiveAmount)}</span>
              </div>
              <div className="flex flex-wrap justify-between items-baseline gap-x-3 gap-y-1 pb-4 border-b border-white/15">
                <span className="text-white/60 text-sm">Target Home Credit</span>
                <span className="font-serif text-lg [overflow-wrap:anywhere]">up to {selectedPlan?.targetReturn}%</span>
              </div>
              <div className="flex flex-wrap justify-between items-baseline gap-x-3 gap-y-1 pb-4 border-b border-white/15">
                <span className="text-white/60 text-sm">Projected Credits</span>
                <span className="font-serif text-xl sm:text-2xl text-[#c47a45] [overflow-wrap:anywhere]">
                  +${formatCurrency(projectedEarnings)}
                </span>
              </div>
              <div className="flex flex-wrap justify-between items-baseline gap-x-3 gap-y-1 pb-4 border-b border-white/15">
                <span className="text-white/60 text-sm">Avg. Monthly Credit</span>
                <span className="font-serif text-lg [overflow-wrap:anywhere]">${formatCurrency(monthlyEarnings)}</span>
              </div>
              <div className="flex flex-wrap justify-between items-baseline gap-x-3 gap-y-1 pt-1">
                <span className="text-sm font-medium">Total at Completion</span>
                <span className="font-serif text-3xl sm:text-4xl text-[#c47a45] [overflow-wrap:anywhere]">
                  ${formatCurrency(totalValue)}
                </span>
              </div>
            </div>

            <Link
              to={`/invest/register?plan=${selectedPlan?.slug ?? "starter"}`}
              className="group mt-10 w-full inline-flex items-center justify-center gap-3 bg-[#c47a45] text-white px-8 py-4 text-[13px] font-medium uppercase tracking-[0.14em] hover:bg-[#a6632f] transition-colors"
            >
              Start Your Plan Now
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1.5" />
            </Link>
            <p className="text-white/40 text-xs mt-5 leading-relaxed">
              Projections are illustrative only and not a guarantee of future performance. Home
              credits are applied toward the purchase of a Nestaro home at plan completion.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
