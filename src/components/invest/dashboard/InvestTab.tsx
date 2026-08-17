import { useMemo, useState, useEffect } from "react";
import { CheckCircle, Star, Wallet, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { formatCurrency } from "@/hooks/use-investor";
import { fallbackPlans, parsePlanFeatures, type PlanDisplay } from "@/lib/investment-plans";
import { SectionCard } from "./shared";
import { VerificationBadgeStrip } from "@/components/invest/VerificationBadge";

// ── Flexible duration helpers (mirror the backend rules) ─────────
type DurationCfg = { legacy: boolean; minDays: number; maxDays: number; allowedDays: number[] | null };

function parseAllowedDays(raw?: string | null): number[] | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      const days = arr.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 365);
      if (days.length) return [...new Set(days)].sort((a, b) => a - b) as number[];
    }
  } catch {
    /* fall through */
  }
  return null;
}

function durationCfgFor(plan: any, project: any | null): DurationCfg {
  const legacyDays = Number(plan?.durationMonths ?? 0) * 30;
  const projectConfigured =
    !!project && (project.minDurationDays != null || project.maxDurationDays != null || !!project.allowedDurationDays);
  const src = projectConfigured ? project : plan;
  const configured = !!src && (src.minDurationDays != null || src.maxDurationDays != null || !!src.allowedDurationDays);
  if (!configured) {
    return { legacy: true, minDays: legacyDays, maxDays: legacyDays, allowedDays: null };
  }
  const allowed = parseAllowedDays(src.allowedDurationDays);
  const minDays = src.minDurationDays ?? (allowed ? allowed[0] : 1);
  const maxDays = src.maxDurationDays ?? (allowed ? allowed[allowed.length - 1] : 365);
  return {
    legacy: false,
    minDays: Math.max(1, Math.min(365, minDays)),
    maxDays: Math.max(1, Math.min(365, maxDays)),
    allowedDays: allowed,
  };
}

export default function InvestTab({
  walletBalance,
  onInvested,
  setTab,
}: {
  walletBalance: number;
  onInvested: () => void;
  setTab: (tab: string) => void;
}) {
  const plansQuery = trpc.investor.plans.useQuery(undefined, { retry: false, refetchInterval: 20_000 });
  const plans: PlanDisplay[] =
    plansQuery.data && plansQuery.data.length > 0
      ? (plansQuery.data as PlanDisplay[])
      : fallbackPlans;

  const projectsQuery = trpc.investor.projects.useQuery(undefined, { retry: false, refetchInterval: 20_000 });
  const projects = projectsQuery.data ?? [];

  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? plans.find((p) => p.featured === "yes") ?? plans[0];
  const min = Number(selectedPlan?.minAmount ?? 1000);
  const [amountStr, setAmountStr] = useState("");
  const [projectId, setProjectId] = useState<number | undefined>(undefined);
  const amount = Number(amountStr) || 0;

  const selectedProject = projects.find((p: any) => p.id === projectId) ?? null;
  const durationCfg = useMemo(() => durationCfgFor(selectedPlan, selectedProject), [selectedPlan, selectedProject]);
  const [durationDays, setDurationDays] = useState<number | null>(null);

  // Reset the selected duration whenever the effective config changes
  useEffect(() => {
    if (durationCfg.legacy) {
      setDurationDays(null);
    } else {
      setDurationDays(durationCfg.allowedDays ? durationCfg.allowedDays[0] : durationCfg.minDays);
    }
  }, [durationCfg.legacy, durationCfg.minDays, durationCfg.maxDays, durationCfg.allowedDays]);

  const effectiveDays = durationCfg.legacy ? durationCfg.minDays : (durationDays ?? durationCfg.minDays);
  const maturityDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + effectiveDays);
    return d;
  }, [effectiveDays]);

  const projectedEarnings = useMemo(
    () => (amount * (selectedPlan?.targetReturn ?? 0)) / 100,
    [amount, selectedPlan],
  );

  const invest = trpc.investor.invest.useMutation({
    onSuccess: () => {
      toast.success("Plan submitted for review. It will be activated once approved by our team.");
      setAmountStr("");
      onInvested();
      setTab("portfolio");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleInvest = () => {
    if (!selectedPlan) return;
    if (amount < min) {
      toast.error(`Minimum investment for ${selectedPlan.name} is ${formatCurrency(min)}`);
      return;
    }
    if (amount > walletBalance) {
      toast.error("Insufficient wallet balance. Please deposit first.");
      return;
    }
    if (!durationCfg.legacy) {
      if (durationDays == null) {
        toast.error("Please select a plan duration");
        return;
      }
      if (durationCfg.allowedDays && !durationCfg.allowedDays.includes(durationDays)) {
        toast.error("Please choose one of the available durations");
        return;
      }
      if (durationDays < durationCfg.minDays || durationDays > durationCfg.maxDays) {
        toast.error(`Duration must be between ${durationCfg.minDays} and ${durationCfg.maxDays} days`);
        return;
      }
    }
    invest.mutate({ planId: selectedPlan.id, amount, projectId, durationDays: durationCfg.legacy ? undefined : (durationDays ?? undefined) });
  };

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <div className="col-span-full">
        <VerificationBadgeStrip />
      </div>
      {/* Plan selection */}
      <div className="lg:col-span-3 space-y-4">
        <SectionCard title="Choose a Plan" subtitle="Select where to allocate your capital">
          <div className="space-y-4">
            {plans.map((plan) => {
              const selected = selectedPlan?.id === plan.id;
              const features = parsePlanFeatures(plan.features).slice(0, 4);
              const pcfg = durationCfgFor(plan, null);
              return (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`w-full text-left p-5 rounded-xl border-2 transition ${
                    selected
                      ? "border-[#26342b] bg-[#26342b]/[0.03] shadow-md"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selected ? "border-[#26342b]" : "border-gray-300"
                        }`}
                      >
                        {selected && <div className="w-2.5 h-2.5 rounded-full bg-[#26342b]" />}
                      </div>
                      <div>
                        <p className="font-bold text-[#26342b] flex items-center gap-2">
                          {plan.name}
                          {plan.featured === "yes" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-[#c47a45]/10 text-[#a6632f] px-2 py-0.5 rounded-full">
                              <Star className="w-3 h-3 fill-current" /> Featured
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Min {formatCurrency(plan.minAmount).replace(".00", "")} · up to {plan.targetReturn}% ·{" "}
                          {pcfg.legacy ? `${plan.durationMonths} months` : pcfg.allowedDays ? `${pcfg.allowedDays.join(" / ")} days` : `${pcfg.minDays}–${pcfg.maxDays} days`}
                        </p>
                      </div>
                    </div>
                    <p className={`text-2xl font-bold font-serif ${selected ? "text-[#c47a45]" : "text-[#26342b]"}`}>
                      {plan.targetReturn}%
                    </p>
                  </div>
                  {selected && (
                    <ul className="grid sm:grid-cols-2 gap-2 mt-4 pt-4 border-t border-gray-100">
                      {features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                          <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </button>
              );
            })}
          </div>
        </SectionCard>

        {/* Optional project */}
        {projects.length > 0 && (
          <SectionCard title="Allocate to a Project" subtitle="Optional — otherwise funds are diversified">
            <div className="space-y-3">
              <button
                onClick={() => setProjectId(undefined)}
                className={`w-full text-left p-4 rounded-xl border-2 transition ${
                  projectId === undefined ? "border-[#26342b] bg-[#26342b]/[0.03]" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <p className="font-semibold text-[#26342b] text-sm">Diversified Plan (recommended)</p>
                <p className="text-xs text-gray-500 mt-0.5">Spread across all active developments</p>
              </button>
              {projects.map((project: any) => (
                <button
                  key={project.id}
                  onClick={() => setProjectId(project.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition flex items-center gap-4 ${
                    projectId === project.id ? "border-[#26342b] bg-[#26342b]/[0.03]" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <img
                    src={project.image || "/images/home-exterior-1.jpg"}
                    alt={project.name}
                    className="w-14 h-14 rounded-lg object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-[#26342b] text-sm truncate">{project.name}</p>
                    <p className="text-xs text-gray-500">
                      {project.location} · up to {project.expectedReturn}% · {project.durationMonths} mo
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </SectionCard>
        )}
      </div>

      {/* Amount + summary */}
      <div className="lg:col-span-2">
        <div className="bg-[#26342b] rounded-2xl p-6 text-white sticky top-24">
          <h3 className="text-xl font-bold font-serif mb-6">Plan Summary</h3>

          <div className="bg-white/10 rounded-xl p-4 mb-5 flex items-center justify-between">
            <span className="text-sm text-gray-300 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#c47a45]" />
              Wallet Balance
            </span>
            <span className="font-bold">{formatCurrency(walletBalance)}</span>
          </div>

          <Label htmlFor="invest-amount" className="text-gray-200 text-sm">
            Amount ({selectedPlan?.name} plan)
          </Label>
          <div className="relative mt-2 mb-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
            <Input
              id="invest-amount"
              type="number"
              min={min}
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder={min.toLocaleString()}
              className="pl-8 h-12 bg-white text-[#26342b] font-bold text-lg"
            />
          </div>
          <p className="text-xs text-gray-400 mb-5">
            Minimum {formatCurrency(min).replace(".00", "")}
          </p>

          {!durationCfg.legacy && (
            <div className="mb-5">
              <Label htmlFor="invest-duration" className="text-gray-200 text-sm flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4 text-[#c47a45]" />
                Investment Duration
              </Label>
              {durationCfg.allowedDays ? (
                <select
                  id="invest-duration"
                  value={durationDays ?? durationCfg.allowedDays[0]}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className="mt-2 w-full h-12 px-3 rounded-md bg-white text-[#26342b] font-semibold text-sm"
                >
                  {durationCfg.allowedDays.map((d) => (
                    <option key={d} value={d}>
                      {d} days
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <Input
                    id="invest-duration"
                    type="number"
                    min={durationCfg.minDays}
                    max={durationCfg.maxDays}
                    value={durationDays ?? durationCfg.minDays}
                    onChange={(e) => setDurationDays(Math.floor(Number(e.target.value) || 0))}
                    className="mt-2 h-12 bg-white text-[#26342b] font-bold"
                  />
                  <p className="text-xs text-gray-400 mt-1.5">
                    Between {durationCfg.minDays} and {durationCfg.maxDays} days
                  </p>
                </>
              )}
            </div>
          )}

          <div className="space-y-3 text-sm border-t border-white/10 pt-4 mb-6">
            <div className="flex justify-between">
              <span className="text-gray-300">Term</span>
              <span className="font-semibold">{effectiveDays} days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Matures On</span>
              <span className="font-semibold">{maturityDate.toDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Target Return</span>
              <span className="font-semibold text-green-400">up to {selectedPlan?.targetReturn}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Projected Earnings</span>
              <span className="font-semibold text-green-400">+{formatCurrency(projectedEarnings)}</span>
            </div>
            <div className="flex justify-between text-base pt-2 border-t border-white/10">
              <span className="text-gray-200">Value at Completion</span>
              <span className="font-bold font-serif text-[#c47a45]">
                {formatCurrency(amount + projectedEarnings)}
              </span>
            </div>
          </div>

          {amount > walletBalance && amountStr && (
            <div className="bg-red-500/20 border border-red-400/30 text-red-200 text-xs rounded-lg p-3 mb-4">
              Insufficient balance —{" "}
              <button className="underline font-semibold" onClick={() => setTab("deposit")}>
                make a deposit
              </button>{" "}
              first.
            </div>
          )}

          <Button
            onClick={handleInvest}
            disabled={invest.isPending || !amountStr}
            className="w-full h-12 bg-[#c47a45] transition text-base font-semibold"
          >
            {invest.isPending ? "Processing..." : "Confirm Plan"}
          </Button>
          <p className="text-[11px] text-gray-400 mt-3 text-center">
            Funds are locked for the plan term. Target returns are not guaranteed.
          </p>
        </div>
      </div>
    </div>
  );
}
