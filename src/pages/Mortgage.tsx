import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ChevronDown, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import Navbar from "@/components/Navbar";
import AnnouncementBar from "@/components/AnnouncementBar";
import Footer from "@/sections/Footer";
import WhatsAppChat from "@/components/WhatsAppChat";
import { trpc } from "@/providers/trpc";
import { formatCurrency, formatDate } from "@/hooks/use-investor";
import {
  quoteMortgageClient, buildSchedule, estimatedCompletionClient,
} from "@/lib/mortgage-math";

const faqs = [
  {
    q: "Who can apply for financing?",
    a: "Any registered Nestaro Homes customer can apply. Simply choose an eligible home, select the financing option during checkout or on the home page, pick a plan, and submit. Every application is reviewed by our team, and you'll be notified as soon as a decision is made.",
  },
  {
    q: "How do financing payments work?",
    a: "All payments are made from your customer wallet — there are no external transfers to set up. Your first payment covers the down payment and activates your mortgage. After that you can pay any amount at any time, and every payment instantly reduces your remaining balance.",
  },
  {
    q: "What happens after my application is approved?",
    a: "The property appears in the My Mortgages section of your customer dashboard with your full payment schedule, next payment date, and live progress tracking. Make the down payment from your wallet to activate the plan.",
  },
  {
    q: "Can I pay off my financing early?",
    a: "Yes. You may pay any amount above the scheduled installment at any time, with no early-repayment penalties. Once the remaining balance reaches zero, the financing is marked completed automatically.",
  },
  {
    q: "What if I miss a payment?",
    a: "We'll send you reminders before and after a due date. Each plan includes a grace period, and a late fee may apply afterwards as shown in your plan terms. If you run into difficulty, contact support early — we're here to help.",
  },
  {
    q: "How is the total cost calculated?",
    a: "Each plan has a flat interest rate shown upfront. Your total contract value is the property price plus that flat rate — no compounding, no hidden charges. The down payment, installment amount, and estimated completion date are all shown before you apply.",
  },
];

const steps = [
  { title: "Choose a Home", text: "Browse the catalog and pick any financing-eligible home — look for the Financing Available badge." },
  { title: "Pick a Plan & Apply", text: "Select the financing option, compare plans, and submit your application in under two minutes." },
  { title: "Admin Review", text: "Our team reviews every application promptly. You're notified the moment a decision is made." },
  { title: "Pay & Own", text: "Pay the down payment from your wallet to activate, then installments at your own pace until you own it." },
];

export default function Mortgage() {
  const location = useLocation();
  const navigate = useNavigate();
  const plansQuery = trpc.mortgage.publicPlans.useQuery(undefined, { retry: false });
  const productsQuery = trpc.products.list.useQuery(undefined, { retry: false });

  // Smooth-scroll to hash targets when arriving from the navigation menu
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.replace("#", "");
    const t = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => clearTimeout(t);
  }, [location.hash, plansQuery.data, productsQuery.data]);

  // ── Calculator state ──────────────────────────────────────────
  const [calcPrice, setCalcPrice] = useState("120000");
  const [calcPlanId, setCalcPlanId] = useState<number | null>(null);
  const plans = plansQuery.data ?? [];
  const calcPlan = useMemo(
    () => plans.find((p) => p.id === calcPlanId) ?? plans[0],
    [plans, calcPlanId],
  );
  const calc = useMemo(() => {
    const price = Number(calcPrice);
    if (!calcPlan || !Number.isFinite(price) || price <= 0) return null;
    const q = quoteMortgageClient(price, calcPlan);
    return {
      ...q,
      completion: estimatedCompletionClient(new Date(), q.durationMonths),
      schedule: buildSchedule(q.totalPayable, q.downPayment, q.installment, q.periods, calcPlan.paymentFrequency),
    };
  }, [calcPrice, calcPlan]);

  const [faqOpen, setFaqOpen] = useState<number | null>(0);

  const eligible = (productsQuery.data ?? []).filter(
    (p: any) => p.mortgageEnabled === "yes" && p.isActive === "yes",
  );

  return (
    <div className="min-h-screen bg-[#f7f4ee]">
      <Navbar />
      <AnnouncementBar />
      <main>
        {/* ── Hero / Financing Information ─────────────────────── */}
        <section id="info" className="bg-[#192420] text-white pt-32 pb-24 scroll-mt-24">
          <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
            <div className="max-w-3xl">
              <p className="nh-label mb-5">Nestaro Homes Financing</p>
              <h1 className="nh-display text-4xl sm:text-6xl !text-white mb-6">
                Own Your Home, One Payment at a Time
              </h1>
              <p className="text-lg text-white/80 mb-8 leading-relaxed">
                Purchase any eligible Nestaro tiny home outright or spread the cost with a flexible
                financing plan. Transparent flat-rate pricing, wallet-based payments, and live progress
                tracking from your customer dashboard — no paperwork marathons.
              </p>
              <div className="flex flex-wrap items-center gap-6">
                <a
                  href="#properties"
                  className="inline-flex items-center gap-3 bg-[#c47a45] text-white px-8 py-4 text-[13px] font-medium uppercase tracking-[0.14em] hover:bg-[#a6632f] transition-colors"
                >
                  Get Financing <ArrowRight className="w-4 h-4" />
                </a>
                <a href="#calculator" className="nh-link !text-white">
                  Try the Calculator <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ────────────────────────────────────── */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
            <div className="grid grid-cols-12 gap-6 items-end mb-16">
              <div className="col-span-12 lg:col-span-5">
                <p className="nh-label mb-5">The Process</p>
                <h2 className="nh-display text-4xl md:text-5xl">How It Works</h2>
              </div>
              <div className="col-span-12 lg:col-span-6 lg:col-start-7">
                <p className="text-[#3d5045] leading-relaxed">
                  From application to ownership in four straightforward steps.
                </p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 border-t border-l border-[#e5e7eb]">
              {steps.map((s, i) => (
                <div key={s.title} className="border-b border-r border-[#e5e7eb] p-8 bg-white">
                  <p className="font-serif text-sm text-[#c47a45] mb-6">0{i + 1}</p>
                  <h3 className="font-serif text-xl text-[#192420] mb-3">{s.title}</h3>
                  <p className="text-sm text-[#3d5045] leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Available Financing Plans ────────────────────────── */}
        <section id="plans" className="py-24 bg-white scroll-mt-24">
          <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
            <div className="grid grid-cols-12 gap-6 items-end mb-16">
              <div className="col-span-12 lg:col-span-6">
                <p className="nh-label mb-5">Financing Plans</p>
                <h2 className="nh-display text-4xl md:text-5xl">Available Financing Plans</h2>
              </div>
              <div className="col-span-12 lg:col-span-5 lg:col-start-8">
                <p className="text-[#3d5045] leading-relaxed">
                  Every plan is flat-rate and fully transparent — what you see is exactly what you pay.
                </p>
              </div>
            </div>
            {plansQuery.isLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-10 h-10 border-4 border-[#26342b] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : plans.length === 0 ? (
              <p className="text-center text-gray-400 py-10">
                Financing plans are being prepared — please check back soon or contact us for details.
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {plans.map((p) => (
                  <div key={p.id} className="border border-[#e5e7eb] p-8 hover:border-[#26342b] transition-colors duration-300">
                    <div className="mb-6">
                      <h3 className="font-serif text-2xl text-[#192420]">{p.name}</h3>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-[#3d5045] mt-1 capitalize">
                        {p.planType} plan · {p.paymentFrequency} payments
                      </p>
                    </div>
                    <div className="divide-y divide-[#e5e7eb] border-t border-b border-[#e5e7eb] text-sm">
                      <div className="flex justify-between py-3">
                        <span className="text-[#3d5045]">Duration</span>
                        <span className="font-medium text-[#192420]">
                          {p.planType === "yearly" ? `${p.durationValue} years` : `${p.durationValue} months`}
                        </span>
                      </div>
                      <div className="flex justify-between py-3">
                        <span className="text-[#3d5045]">Down Payment</span>
                        <span className="font-medium text-[#c47a45]">{Number(p.downPaymentPercent)}%</span>
                      </div>
                      <div className="flex justify-between py-3">
                        <span className="text-[#3d5045]">Interest (flat)</span>
                        <span className="font-medium text-[#192420]">{Number(p.interestPercent)}%</span>
                      </div>
                      <div className="flex justify-between py-3">
                        <span className="text-[#3d5045]">Grace Period</span>
                        <span className="font-medium text-[#192420]">{p.gracePeriodDays ?? 0} days</span>
                      </div>
                    </div>
                    {p.lateFeePercent != null && (
                      <p className="text-xs text-[#9ca3af] mt-4">Late fee: {Number(p.lateFeePercent)}% after grace period</p>
                    )}
                    <a href="#calculator" className="nh-link mt-6 inline-flex">
                      Calculate with this plan <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Financing Calculator ─────────────────────────────── */}
        <section id="calculator" className="py-24 scroll-mt-24">
          <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
            <div className="grid grid-cols-12 gap-6 items-end mb-16">
              <div className="col-span-12 lg:col-span-5">
                <p className="nh-label mb-5">Financing Calculator</p>
                <h2 className="nh-display text-4xl md:text-5xl">Estimate Your Payments</h2>
              </div>
              <div className="col-span-12 lg:col-span-6 lg:col-start-7">
                <p className="text-[#3d5045] leading-relaxed">
                  Estimate your down payment, installments, and full repayment schedule.
                </p>
              </div>
            </div>
            <div className="grid lg:grid-cols-5 gap-8">
              <div className="lg:col-span-2 bg-white border border-[#e5e7eb] p-8 space-y-6">
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#3d5045]">Property Price ($)</label>
                  <Input
                    type="number"
                    min="1000"
                    step="1000"
                    value={calcPrice}
                    onChange={(e) => setCalcPrice(e.target.value)}
                    className="mt-2 h-12 text-lg font-medium text-[#192420] rounded-none border-[#e0b48c] focus-visible:ring-0 focus-visible:border-[#26342b]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#3d5045]">Financing Plan</label>
                  <select
                    value={calcPlan?.id ?? ""}
                    onChange={(e) => setCalcPlanId(Number(e.target.value))}
                    className="mt-2 w-full h-12 border border-[#e0b48c] bg-white px-3 text-sm font-medium text-[#192420] focus:outline-none focus:border-[#26342b]"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                {calc && calcPlan && (
                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between text-sm border-b border-[#e5e7eb] pb-3"><span className="text-[#3d5045]">Down payment ({calc.downPercent}%)</span><span className="font-medium text-[#c47a45]">${formatCurrency(calc.downPayment)}</span></div>
                    <div className="flex justify-between text-sm border-b border-[#e5e7eb] pb-3"><span className="text-[#3d5045]">{calcPlan.paymentFrequency === "yearly" ? "Yearly" : "Monthly"} installment</span><span className="font-medium text-[#c47a45]">${formatCurrency(calc.installment)}</span></div>
                    <div className="flex justify-between text-sm border-b border-[#e5e7eb] pb-3"><span className="text-[#3d5045]">Number of payments</span><span className="font-medium text-[#192420]">{calc.periods + 1} (incl. down payment)</span></div>
                    <div className="flex justify-between text-sm border-b border-[#e5e7eb] pb-3"><span className="text-[#3d5045]">Interest ({Number(calcPlan.interestPercent)}% flat)</span><span className="font-medium text-[#192420]">${formatCurrency(calc.totalPayable - Number(calcPrice))}</span></div>
                    <div className="flex justify-between pt-1"><span className="font-medium text-[#192420]">Total contract value</span><span className="font-serif text-2xl text-[#192420]">${formatCurrency(calc.totalPayable)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-[#3d5045]">Estimated completion</span><span className="font-medium text-[#192420]">{formatDate(calc.completion)}</span></div>
                  </div>
                )}
              </div>
              <div className="lg:col-span-3 bg-white border border-[#e5e7eb] p-8">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#3d5045] mb-6">
                  Estimated Repayment Schedule
                </p>
                {!calc ? (
                  <p className="text-gray-400 text-sm py-8 text-center">Enter a price and choose a plan to see the schedule.</p>
                ) : (
                  <div className="max-h-96 overflow-y-auto pr-1">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white">
                        <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-[#9ca3af] border-b border-[#e5e7eb]">
                          <th className="pb-2 pr-4 font-semibold">#</th>
                          <th className="pb-2 pr-4 font-semibold">Payment</th>
                          <th className="pb-2 pr-4 font-semibold">Date</th>
                          <th className="pb-2 pr-4 font-semibold text-right">Amount</th>
                          <th className="pb-2 font-semibold text-right">Remaining</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e5e7eb]">
                        {calc.schedule.map((r) => (
                          <tr key={r.n} className={r.n === 0 ? "bg-[#c47a45]/5" : ""}>
                            <td className="py-2.5 pr-4 text-gray-400">{r.n === 0 ? "—" : r.n}</td>
                            <td className="py-2.5 pr-4 font-medium text-[#26342b]">{r.label}</td>
                            <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap">{formatDate(r.date)}</td>
                            <td className="py-2.5 pr-4 text-right font-semibold text-[#26342b]">${formatCurrency(r.amount)}</td>
                            <td className="py-2.5 text-right text-gray-500">${formatCurrency(r.remaining)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Eligible Properties (Apply) ─────────────────────── */}
        <section id="properties" className="py-24 bg-white scroll-mt-24">
          <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
            <div className="grid grid-cols-12 gap-6 items-end mb-16">
              <div className="col-span-12 lg:col-span-5">
                <p className="nh-label mb-5">Apply</p>
                <h2 className="nh-display text-4xl md:text-5xl">Apply for Financing</h2>
              </div>
              <div className="col-span-12 lg:col-span-6 lg:col-start-7">
                <p className="text-[#3d5045] leading-relaxed">
                  These homes are currently eligible for financing. Pick one to start your application.
                </p>
              </div>
            </div>
            {productsQuery.isLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-10 h-10 border-4 border-[#26342b] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : eligible.length === 0 ? (
              <div className="border-t border-[#e5e7eb] pt-10">
                <p className="text-[#3d5045]">No financing-eligible homes right now — browse the full catalog instead.</p>
                <Link to="/#catalog" className="nh-link mt-4 inline-flex">
                  Explore Homes <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14">
                {eligible.map((p: any) => {
                  const img = Array.isArray(p.images) ? p.images[0] : null;
                  return (
                    <article key={p.id} className="group">
                      {img && (
                        <div className="relative aspect-[4/3] overflow-hidden bg-[#f3ede4]">
                          <img
                            src={img}
                            alt={p.name}
                            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                          />
                          <span className="absolute bottom-0 left-0 bg-[#192420] text-white text-[11px] font-medium uppercase tracking-[0.14em] px-3 py-2">
                            Financing Available
                          </span>
                        </div>
                      )}
                      <div className="pt-5">
                        <div className="flex items-baseline justify-between gap-4">
                          <h3 className="font-serif text-xl text-[#192420]">{p.name}</h3>
                          <p className="font-serif text-lg text-[#c47a45] whitespace-nowrap">${formatCurrency(p.price)}</p>
                        </div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-[#3d5045] mt-2">
                          {p.size} · {p.bedrooms} BR · {p.bathrooms} BA
                        </p>
                        <button
                          onClick={() => navigate(`/mortgage/apply/${p.id}`)}
                          className="nh-link mt-4"
                        >
                          Apply for Financing <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ── Financing FAQ ────────────────────────────────────── */}
        <section id="faq" className="py-24 scroll-mt-24 bg-white">
          <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
            <div className="grid grid-cols-12 gap-6 items-end mb-16">
              <div className="col-span-12 lg:col-span-5">
                <p className="nh-label mb-5">Financing FAQ</p>
                <h2 className="nh-display text-4xl md:text-5xl">Before You Apply</h2>
              </div>
              <div className="col-span-12 lg:col-span-6 lg:col-start-7">
                <p className="text-[#3d5045] leading-relaxed">
                  Everything you need to know before applying.
                </p>
              </div>
            </div>
            <div className="max-w-4xl border-t border-[#e5e7eb]">
              {faqs.map((f, i) => (
                <div key={i} className="border-b border-[#e5e7eb]">
                  <button
                    onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 py-6 text-left group"
                  >
                    <span className="font-serif text-xl text-[#192420] group-hover:text-[#c47a45] transition-colors">
                      {f.q}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-[#3d5045] shrink-0 transition-transform ${faqOpen === i ? "rotate-180" : ""}`} />
                  </button>
                  {faqOpen === i && (
                    <p className="pb-6 text-sm text-[#3d5045] leading-relaxed max-w-2xl">{f.a}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA band ────────────────────────────────────────── */}
        <section className="pb-24">
          <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
            <div className="bg-[#192420] p-6 sm:p-14 lg:p-16 text-white">
              <div className="grid grid-cols-12 gap-6 items-end">
                <div className="col-span-12 lg:col-span-7 min-w-0">
                  <p className="nh-label mb-5">Get Started</p>
                  <h2 className="nh-display text-3xl sm:text-5xl !text-white mb-5">Ready to Make It Yours?</h2>
                  <p className="text-white/60 max-w-lg leading-relaxed">
                    Apply in minutes, get a prompt review, and track every payment from your customer dashboard.
                  </p>
                </div>
                <div className="col-span-12 lg:col-span-5 flex flex-wrap lg:justify-end gap-3 sm:gap-4 min-w-0">
                  <a
                    href="#properties"
                    className="inline-flex items-center justify-center gap-3 bg-[#c47a45] text-white px-5 sm:px-8 py-4 text-[13px] font-medium uppercase tracking-[0.14em] hover:bg-[#a6632f] transition-colors"
                  >
                    Start an Application
                  </a>
                  <Link
                    to="/invest/dashboard?tab=mortgages"
                    className="inline-flex items-center justify-center gap-3 border border-white/30 text-white px-5 sm:px-8 py-4 text-[13px] font-medium uppercase tracking-[0.14em] hover:border-white transition-colors"
                  >
                    My Financing
                  </Link>
                </div>
              </div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/40 mt-12 pt-8 border-t border-white/15">
                Flat-rate pricing · Wallet payments · No early-repayment penalties
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppChat />
    </div>
  );
}
