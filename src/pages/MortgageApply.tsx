import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  Landmark, ArrowLeft, CheckCircle2, TrendingUp, Loader2, Calendar,
  Percent, Wallet, Home, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { useInvestor, formatCurrency } from "@/hooks/use-investor";

type PlanOption = {
  id: number;
  name: string;
  planType: "monthly" | "yearly";
  paymentFrequency: "monthly" | "yearly";
  durationValue: number;
  durationMonths: number;
  interestPercent: number;
  downPaymentPercent: number;
  downPayment: number;
  totalPayable: number;
  installment: number;
  periods: number;
  gracePeriodDays: number | null;
  lateFeePercent: number | null;
};

export default function MortgageApply() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { investor, isLoading: authLoading, isAuthenticated } = useInvestor();
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [done, setDone] = useState<{ reference: string } | null>(null);

  const optionsQuery = trpc.mortgage.mortgageOptions.useQuery(
    { productId: Number(productId) },
    { retry: false, enabled: !!productId },
  );

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate(`/invest/login?next=/mortgage/apply/${productId}`, { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, productId]);

  const data = optionsQuery.data;
  const plan: PlanOption | undefined = useMemo(
    () => data?.enabled ? data.plans.find((p) => p.id === selectedPlan) : undefined,
    [data, selectedPlan],
  );

  const apply = trpc.mortgage.applyForMortgage.useMutation({
    onSuccess: (res) => setDone({ reference: res.reference }),
    onError: (err) => toast.error(err.message),
  });

  if (authLoading || optionsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[#f7f4ee] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#26342b] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!data?.enabled) {
    return (
      <div className="min-h-screen bg-[#f7f4ee] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border p-10 text-center max-w-md">
          <Landmark className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-[#26342b] font-serif mb-2">Mortgage Not Available</h2>
          <p className="text-gray-500 text-sm mb-6">This property is currently only available for outright purchase.</p>
          <Link to="/#catalog">
            <Button className="bg-[#26342b]">Back to Catalog</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { product } = data;
  const completionDate = plan
    ? (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + plan.durationMonths);
        return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      })()
    : null;

  return (
    <div className="min-h-screen bg-[#f7f4ee]">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md border-b sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-[#26342b] rounded-lg flex items-center justify-center relative overflow-hidden">
              <TrendingUp className="w-5 h-5 text-[#c47a45]" />
              <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white"></div>
            </div>
            <span className="text-lg font-bold text-[#26342b] font-serif">Nestaro Homes</span>
          </Link>
          <Link to="/#catalog" className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#26342b] transition">
            <ArrowLeft className="w-4 h-4" /> Back to Catalog
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {done ? (
          <div className="max-w-lg mx-auto bg-white rounded-2xl border p-10 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-[#26342b] font-serif mb-2">Application Submitted</h2>
            <p className="text-gray-500 text-sm mb-2">
              Your mortgage application <span className="font-mono font-semibold text-[#26342b]">{done.reference}</span> is
              awaiting review. We'll notify you as soon as the administrator approves it.
            </p>
            <p className="text-xs text-gray-400 mb-6">You can track it anytime under My Mortgages in your dashboard.</p>
            <div className="flex gap-3 justify-center">
              <Link to="/invest/dashboard?tab=mortgages">
                <Button className="bg-[#26342b]">Go to My Mortgages</Button>
              </Link>
              <Link to="/#catalog">
                <Button variant="outline" className="border-[#26342b] text-[#26342b]">Continue Browsing</Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-[#26342b] font-serif flex items-center gap-3">
                <Landmark className="w-8 h-8 text-[#c47a45]" /> Buy with Mortgage
              </h1>
              <p className="text-gray-500 mt-1">Choose a payment plan, review the numbers, and submit your application.</p>
            </div>

            <div className="grid lg:grid-cols-5 gap-8 items-start">
              {/* Left: product + plans */}
              <div className="lg:col-span-3 space-y-6">
                {/* Property card */}
                <div className="bg-white rounded-2xl border p-5 flex flex-col sm:flex-row gap-5">
                  {product.image && (
                    <img src={product.image} alt={product.name} className="w-full sm:w-44 h-40 sm:h-32 object-cover rounded-xl" />
                  )}
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-[#26342b] font-serif">{product.name}</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {product.size} · {product.bedrooms} BR / {product.bathrooms} BA
                    </p>
                    <p className="text-2xl font-bold text-[#c47a45] font-serif mt-2">{formatCurrency(product.price)}</p>
                  </div>
                </div>

                {/* Plan selection */}
                <div className="bg-white rounded-2xl border p-6">
                  <h3 className="font-bold text-[#26342b] mb-1">Select a Mortgage Plan</h3>
                  <p className="text-xs text-gray-400 mb-4">Plans offered for this property by Nestaro Homes.</p>
                  {data.plans.length === 0 ? (
                    <p className="text-sm text-gray-500 py-6 text-center">No active mortgage plans for this property right now.</p>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {data.plans.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPlan(p.id)}
                          className={`text-left rounded-xl border-2 p-4 transition ${
                            selectedPlan === p.id
                              ? "border-[#c47a45] bg-[#c47a45]/5 shadow-md"
                              : "border-gray-200 hover:border-[#c47a45]/50"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-bold text-[#26342b]">{p.name}</p>
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-[#26342b]/5 text-[#26342b] px-2 py-0.5 rounded-full">
                              {p.paymentFrequency}
                            </span>
                          </div>
                          <p className="text-2xl font-bold text-[#c47a45] font-serif">
                            {formatCurrency(p.installment)}
                            <span className="text-xs text-gray-400 font-normal">/{p.paymentFrequency === "yearly" ? "yr" : "mo"}</span>
                          </p>
                          <div className="text-xs text-gray-500 mt-2 space-y-1">
                            <p>Duration: {p.durationValue} {p.planType === "yearly" ? "years" : "months"}</p>
                            <p>Down payment: {formatCurrency(p.downPayment)} ({p.downPaymentPercent}%)</p>
                            <p>Interest: {p.interestPercent}% flat</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {data.conditions && (
                  <div className="bg-[#f7f4ee] border border-[#c47a45]/30 rounded-2xl p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#a6632f] mb-1.5">Mortgage Conditions</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{data.conditions}</p>
                  </div>
                )}
              </div>

              {/* Right: summary */}
              <div className="lg:col-span-2 lg:sticky lg:top-24 space-y-5">
                <div className="bg-white rounded-2xl border p-6">
                  <h3 className="font-bold text-[#26342b] mb-4">Mortgage Summary</h3>
                  {!plan ? (
                    <p className="text-sm text-gray-400 py-6 text-center">Select a plan to see your full payment breakdown.</p>
                  ) : (
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500 flex items-center gap-1.5"><Home className="w-4 h-4" />Property Price</span><span className="font-semibold text-[#26342b]">{formatCurrency(product.price)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500 flex items-center gap-1.5"><Percent className="w-4 h-4" />Interest ({plan.interestPercent}%)</span><span className="font-semibold text-[#26342b]">{formatCurrency(plan.totalPayable - product.price)}</span></div>
                      <div className="flex justify-between border-t pt-3"><span className="text-gray-700 font-semibold">Total Contract Value</span><span className="font-bold text-[#26342b]">{formatCurrency(plan.totalPayable)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500 flex items-center gap-1.5"><Wallet className="w-4 h-4" />Down Payment</span><span className="font-semibold text-[#a6632f]">{formatCurrency(plan.downPayment)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">{plan.paymentFrequency === "yearly" ? "Yearly" : "Monthly"} Payment</span><span className="font-bold text-[#c47a45] text-base">{formatCurrency(plan.installment)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Number of Payments</span><span className="font-semibold text-[#26342b]">{plan.periods}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500 flex items-center gap-1.5"><Calendar className="w-4 h-4" />Est. Completion</span><span className="font-semibold text-[#26342b]">{completionDate}</span></div>
                      <div className="flex justify-between border-t pt-3"><span className="text-gray-500">Remaining Balance</span><span className="font-semibold text-[#26342b]">{formatCurrency(plan.totalPayable)}</span></div>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl border p-6">
                  <h3 className="font-bold text-[#26342b] mb-3">Applicant</h3>
                  <div className="text-sm space-y-1.5">
                    <p className="font-semibold text-[#26342b]">{investor?.name}</p>
                    <p className="text-gray-500">{investor?.email}</p>
                    {investor?.phone && <p className="text-gray-500">{investor.phone}</p>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-4">
                    <ShieldCheck className="w-4 h-4 text-[#c47a45]" />
                    Payments are made from your investor wallet after approval.
                  </div>
                  <Button
                    className="w-full mt-5 bg-[#26342b] py-6 text-base"
                    disabled={!plan || apply.isPending}
                    onClick={() => plan && apply.mutate({ productId: product.id, planId: plan.id })}
                  >
                    {apply.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Landmark className="w-5 h-5 mr-2" />}
                    Submit Mortgage Application
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
