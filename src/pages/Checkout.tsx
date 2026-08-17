import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowLeft, Lock, CreditCard, Building2, Bitcoin, ShoppingBag, CheckCircle,
  Landmark, CalendarClock, Wallet, User, LogIn, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Navbar from "@/components/Navbar";
import Footer from "@/sections/Footer";
import WhatsAppChat from "@/components/WhatsAppChat";
import { useCart } from "@/hooks/use-cart";
import { useInvestor, formatCurrency, formatDate } from "@/hooks/use-investor";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { addPeriodClient, buildSchedule, estimatedCompletionClient } from "@/lib/mortgage-math";
import { CountrySelect, USStateSelect } from "@/components/GeoSelects";

const paymentMethods = [
  { id: "paypal" as const, label: "PayPal", icon: CreditCard, note: "Pay securely with your PayPal account" },
  { id: "bank" as const, label: "Bank Transfer", icon: Building2, note: "Wire transfer instructions sent after ordering" },
  { id: "crypto" as const, label: "Cryptocurrency", icon: Bitcoin, note: "BTC, ETH or USDT accepted" },
];

export default function Checkout() {
  const navigate = useNavigate();
  const { items, totalPrice, totalItems, clearCart } = useCart();
  const { isAuthenticated, investor } = useInvestor();
  const [paymentMethod, setPaymentMethod] = useState<"paypal" | "bank" | "crypto">("paypal");
  const [purchaseMethod, setPurchaseMethod] = useState<"outright" | "mortgage">("outright");
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [mortgageDone, setMortgageDone] = useState<{ reference: string } | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
    country: "United States",
    state: "",
    city: "",
    postalCode: "",
  });

  // A mortgage covers exactly one property (single cart line, quantity 1)
  const singleItem = items.length === 1 && items[0].quantity === 1 ? items[0] : null;
  const optionsQuery = trpc.mortgage.mortgageOptions.useQuery(
    { productId: singleItem?.productId ?? 0 },
    { enabled: !!singleItem, retry: false },
  );
  const optionsData = optionsQuery.data;
  const mortgagePlans =
    singleItem && optionsData && optionsData.enabled ? (optionsData.plans ?? []) : [];
  const mortgageAvailable = !!singleItem && mortgagePlans.length > 0;
  const selectedPlan = mortgagePlans.find((p) => p.id === selectedPlanId) ?? null;

  const schedule = useMemo(() => {
    if (!selectedPlan) return null;
    return buildSchedule(
      selectedPlan.totalPayable,
      selectedPlan.downPayment,
      selectedPlan.installment,
      selectedPlan.periods,
      selectedPlan.paymentFrequency,
    );
  }, [selectedPlan]);

  const createOrder = trpc.orders.create.useMutation({
    onSuccess: (data) => {
      clearCart();
      toast.success("Order placed successfully!");
      navigate(`/track-order?order=${data.orderNumber}&email=${encodeURIComponent(form.email)}`);
    },
    onError: (err) => toast.error(err.message || "Failed to place order"),
  });

  const applyForMortgage = trpc.mortgage.applyForMortgage.useMutation({
    onSuccess: (res) => {
      clearCart();
      setMortgageDone({ reference: res.reference });
    },
    onError: (err) => toast.error(err.message || "Could not submit the application"),
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const choosePurchase = (method: "outright" | "mortgage") => {
    setPurchaseMethod(method);
    if (method === "mortgage" && mortgagePlans.length > 0 && selectedPlanId === null) {
      setSelectedPlanId(mortgagePlans[0].id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    // ── Mortgage path ─────────────────────────────────────────
    if (purchaseMethod === "mortgage") {
      if (!mortgageAvailable || !singleItem || !selectedPlan) {
        toast.error("Mortgage purchase is not available for this cart.");
        return;
      }
      if (!isAuthenticated) {
        toast.info("Mortgage applications require an investor account — please log in or create one.", { duration: 5000 });
        navigate(`/invest/login?next=${encodeURIComponent("/checkout")}`);
        return;
      }
      applyForMortgage.mutate({ productId: singleItem.productId, planId: selectedPlan.id });
      return;
    }

    // ── Outright path ─────────────────────────────────────────
    createOrder.mutate({
      customer: {
        firstName: form.firstName,
        middleName: form.middleName || undefined,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        country: form.country,
        state: form.state,
        city: form.city,
        postalCode: form.postalCode,
      },
      items: items.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        quantity: i.quantity,
        unitPrice: i.price,
        totalPrice: i.price * i.quantity,
      })),
      paymentMethod,
      totalAmount: totalPrice,
    });
  };

  // ── Mortgage application success ──────────────────────────────
  if (mortgageDone) {
    return (
      <div className="min-h-screen bg-[#f7f4ee]">
        <Navbar />
        <main className="pt-24 pb-20">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-2xl p-8 sm:p-12 shadow-sm text-center">
              <div className="w-16 h-16 bg-[#26342b] rounded-full flex items-center justify-center mx-auto mb-5">
                <Landmark className="w-8 h-8 text-[#c47a45]" />
              </div>
              <h1 className="text-3xl font-serif font-bold text-[#26342b] mb-3">Application Submitted</h1>
              <p className="text-gray-500 mb-2">
                Your financing application is now <span className="font-semibold text-amber-600">pending review</span>.
              </p>
              <p className="text-sm text-gray-400 mb-6">
                Reference: <span className="font-mono font-semibold text-[#26342b]">{mortgageDone.reference}</span>
              </p>
              <div className="bg-[#f7f4ee] rounded-xl p-4 text-sm text-gray-500 mb-8">
                You'll be notified as soon as our team reviews the application. Once approved, pay the down
                payment from your wallet to activate the plan — the property will appear in your My Mortgages section.
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <Link to="/invest/dashboard?tab=mortgages">
                  <Button className="bg-[#26342b]">
                    <Wallet className="w-4 h-4 mr-2" /> Go to My Mortgages
                  </Button>
                </Link>
                <Link to="/#catalog">
                  <Button variant="outline" className="border-[#26342b] text-[#26342b]">Back to Catalog</Button>
                </Link>
              </div>
            </div>
          </div>
        </main>
        <Footer />
        <WhatsAppChat />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f4ee]">
      <Navbar />
      <main className="pt-24 pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-[#26342b] hover:text-[#3d5045] mb-6">
            <ArrowLeft className="w-4 h-4" />
            Continue Shopping
          </Link>

          <h1 className="text-4xl font-serif font-bold text-[#26342b] mb-8">Checkout</h1>

          {items.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
              <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-[#26342b] mb-2">Your cart is empty</h2>
              <p className="text-gray-500 mb-6">Add a home to your cart before checking out.</p>
              <Link to="/#catalog">
                <Button className="bg-[#26342b]">
                  Browse Homes
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-8">
              {/* Left: Purchase method + Buyer details + Payment */}
              <div className="lg:col-span-2 space-y-8">
                {/* Purchase Method — only when the property is mortgage-eligible */}
                {mortgageAvailable && singleItem && (
                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h2 className="text-xl font-bold text-[#26342b] mb-6">Purchase Method</h2>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => choosePurchase("outright")}
                        className={`flex flex-col gap-2 p-5 rounded-xl border-2 transition text-left ${
                          purchaseMethod === "outright"
                            ? "border-[#26342b] bg-[#26342b]/5"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${
                          purchaseMethod === "outright" ? "bg-[#26342b] text-white" : "bg-gray-100 text-gray-500"
                        }`}>
                          <ShoppingBag className="w-5 h-5" />
                        </div>
                        <p className="font-bold text-[#26342b]">Buy Outright</p>
                        <p className="text-sm text-gray-500">
                          Pay the full property price of {formatCurrency(singleItem.price)} and proceed to payment.
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => choosePurchase("mortgage")}
                        className={`flex flex-col gap-2 p-5 rounded-xl border-2 transition text-left ${
                          purchaseMethod === "mortgage"
                            ? "border-[#c47a45] bg-[#c47a45]/5"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${
                          purchaseMethod === "mortgage" ? "bg-[#c47a45] text-white" : "bg-gray-100 text-gray-500"
                        }`}>
                          <Landmark className="w-5 h-5" />
                        </div>
                        <p className="font-bold text-[#26342b]">Buy with Financing</p>
                        <p className="text-sm text-gray-500">
                          Spread the cost with a mortgage plan — pay installments from your investor wallet.
                        </p>
                      </button>
                    </div>

                    {/* Mortgage plan selection */}
                    {purchaseMethod === "mortgage" && (
                      <div className="mt-6 space-y-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Select a Financing Plan</p>
                        <div className="space-y-3">
                          {mortgagePlans.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setSelectedPlanId(p.id)}
                              className={`w-full flex flex-wrap items-center gap-4 p-4 rounded-xl border-2 transition text-left ${
                                selectedPlanId === p.id
                                  ? "border-[#26342b] bg-[#26342b]/5"
                                  : "border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              <div className="flex-1 min-w-[140px]">
                                <p className="font-bold text-[#26342b]">{p.name}</p>
                                <p className="text-xs text-gray-400 capitalize">
                                  {p.planType} · {p.paymentFrequency} payments · {p.interestPercent}% flat interest
                                </p>
                              </div>
                              <div className="text-sm">
                                <p className="text-[11px] text-gray-400">Down payment ({p.downPaymentPercent}%)</p>
                                <p className="font-bold text-[#a6632f]">{formatCurrency(p.downPayment)}</p>
                              </div>
                              <div className="text-sm">
                                <p className="text-[11px] text-gray-400">{p.paymentFrequency === "yearly" ? "Yearly" : "Monthly"} installment</p>
                                <p className="font-bold text-[#c47a45]">{formatCurrency(p.installment)}</p>
                              </div>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                selectedPlanId === p.id ? "border-[#26342b]" : "border-gray-300"
                              }`}>
                                {selectedPlanId === p.id && <div className="w-2.5 h-2.5 rounded-full bg-[#26342b]" />}
                              </div>
                            </button>
                          ))}
                        </div>

                        {/* Selected plan summary */}
                        {selectedPlan && (
                          <div className="bg-[#f7f4ee] rounded-xl p-5 space-y-2.5 text-sm">
                            <div className="flex justify-between"><span className="text-gray-500">Home price</span><span className="font-semibold text-[#26342b]">{formatCurrency(singleItem.price)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Down payment (due to activate)</span><span className="font-bold text-[#a6632f]">{formatCurrency(selectedPlan.downPayment)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">{selectedPlan.paymentFrequency === "yearly" ? "Yearly" : "Monthly"} repayment</span><span className="font-bold text-[#c47a45]">{formatCurrency(selectedPlan.installment)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Duration</span><span className="font-semibold text-[#26342b]">{selectedPlan.durationMonths} months ({selectedPlan.periods} payments)</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Next payment date</span><span className="font-semibold text-[#26342b]">{formatDate(addPeriodClient(new Date(), selectedPlan.paymentFrequency))}</span></div>
                            <div className="flex justify-between border-t pt-2.5"><span className="font-semibold text-[#26342b]">Total payable</span><span className="font-bold text-[#26342b] text-base">{formatCurrency(selectedPlan.totalPayable)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Estimated completion</span><span className="font-semibold text-[#26342b]">{formatDate(estimatedCompletionClient(new Date(), selectedPlan.durationMonths))}</span></div>
                          </div>
                        )}

                        {/* Estimated repayment schedule */}
                        {schedule && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <CalendarClock className="w-4 h-4 text-[#c47a45]" /> Estimated Repayment Schedule
                            </p>
                            <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-xl">
                              <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-white">
                                  <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b">
                                    <th className="py-2.5 px-4 font-semibold">Payment</th>
                                    <th className="py-2.5 px-4 font-semibold">Date</th>
                                    <th className="py-2.5 px-4 font-semibold text-right">Amount</th>
                                    <th className="py-2.5 px-4 font-semibold text-right">Remaining</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {schedule.map((r) => (
                                    <tr key={r.n} className={r.n === 0 ? "bg-[#c47a45]/5" : ""}>
                                      <td className="py-2 px-4 font-medium text-[#26342b]">{r.label}</td>
                                      <td className="py-2 px-4 text-gray-500 whitespace-nowrap">{formatDate(r.date)}</td>
                                      <td className="py-2 px-4 text-right font-semibold text-[#26342b]">{formatCurrency(r.amount)}</td>
                                      <td className="py-2 px-4 text-right text-gray-500">{formatCurrency(r.remaining)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {optionsData && optionsData.enabled && optionsData.conditions && (
                          <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
                            <span className="font-semibold text-amber-700">Plan conditions: </span>
                            {optionsData.conditions}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Applicant (mortgage) or Buyer Information (outright) */}
                {purchaseMethod === "mortgage" ? (
                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h2 className="text-xl font-bold text-[#26342b] mb-4">Applicant Information</h2>
                    {isAuthenticated && investor ? (
                      <div className="flex items-center gap-4 bg-[#f7f4ee] rounded-xl p-4">
                        <div className="w-11 h-11 bg-[#26342b] rounded-xl flex items-center justify-center shrink-0">
                          <User className="w-5 h-5 text-[#c47a45]" />
                        </div>
                        <div>
                          <p className="font-semibold text-[#26342b]">{investor.name}</p>
                          <p className="text-xs text-gray-400">{investor.email}</p>
                          <p className="text-xs text-gray-400 mt-0.5">The application is filed against your customer account.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                        <LogIn className="w-8 h-8 text-amber-600 shrink-0" />
                        <div className="flex-1">
                          <p className="font-semibold text-amber-800">Customer account required</p>
                          <p className="text-sm text-amber-700 mt-0.5">
                            Mortgage applications are linked to an investor account so you can pay from your wallet
                            and track everything in My Mortgages.
                          </p>
                        </div>
                        <Button
                          type="button"
                          onClick={() => navigate(`/invest/login?next=${encodeURIComponent("/checkout")}`)}
                          className="bg-[#26342b] shrink-0"
                        >
                          Log In / Register
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h2 className="text-xl font-bold text-[#26342b] mb-6">Buyer Information</h2>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">First Name *</Label>
                        <Input id="firstName" required value={form.firstName} onChange={(e) => update("firstName", e.target.value)} className="mt-1.5" />
                      </div>
                      <div>
                        <Label htmlFor="middleName">Middle Name</Label>
                        <Input id="middleName" value={form.middleName} onChange={(e) => update("middleName", e.target.value)} className="mt-1.5" />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name *</Label>
                        <Input id="lastName" required value={form.lastName} onChange={(e) => update("lastName", e.target.value)} className="mt-1.5" />
                      </div>
                      <div>
                        <Label htmlFor="email">Email *</Label>
                        <Input id="email" type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} className="mt-1.5" />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone *</Label>
                        <Input id="phone" required value={form.phone} onChange={(e) => update("phone", e.target.value)} className="mt-1.5" />
                      </div>
                      <div>
                        <Label htmlFor="country">Country *</Label>
                        <CountrySelect
                          id="country"
                          required
                          value={form.country}
                          onChange={(v) => update("country", v)}
                          className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#c47a45]/40 focus:border-[#c47a45]"
                        />
                      </div>
                      <div>
                        <Label htmlFor="state">State / Region *</Label>
                        {form.country === "United States" ? (
                          <USStateSelect
                            id="state"
                            required
                            value={form.state}
                            onChange={(v) => update("state", v)}
                            className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#c47a45]/40 focus:border-[#c47a45]"
                          />
                        ) : (
                          <Input id="state" required value={form.state} onChange={(e) => update("state", e.target.value)} className="mt-1.5" />
                        )}
                      </div>
                      <div>
                        <Label htmlFor="city">City *</Label>
                        <Input id="city" required value={form.city} onChange={(e) => update("city", e.target.value)} className="mt-1.5" />
                      </div>
                      <div>
                        <Label htmlFor="postalCode">Postal Code *</Label>
                        <Input id="postalCode" required value={form.postalCode} onChange={(e) => update("postalCode", e.target.value)} className="mt-1.5" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Method — outright purchases only */}
                {purchaseMethod === "outright" && (
                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h2 className="text-xl font-bold text-[#26342b] mb-6">Payment Method</h2>
                    <div className="space-y-3">
                      {paymentMethods.map((method) => (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setPaymentMethod(method.id)}
                          className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition text-left ${
                            paymentMethod === method.id
                              ? "border-[#26342b] bg-[#26342b]/5"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${
                            paymentMethod === method.id ? "bg-[#26342b] text-white" : "bg-gray-100 text-gray-500"
                          }`}>
                            <method.icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-[#26342b]">{method.label}</p>
                            <p className="text-sm text-gray-500">{method.note}</p>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            paymentMethod === method.id ? "border-[#26342b]" : "border-gray-300"
                          }`}>
                            {paymentMethod === method.id && (
                              <div className="w-2.5 h-2.5 rounded-full bg-[#26342b]" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-4 flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5" />
                      Full payment is verified before documentation begins. All payments are SSL secured.
                    </p>
                  </div>
                )}
              </div>

              {/* Right: Order Summary */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-24">
                  <h2 className="text-xl font-bold text-[#26342b] mb-6">Order Summary</h2>
                  <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                    {items.map((item) => (
                      <div key={item.productId} className="flex gap-3">
                        <img src={item.image} alt={item.productName} className="w-16 h-16 object-cover rounded-lg" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[#26342b] text-sm truncate">{item.productName}</p>
                          <p className="text-xs text-gray-500">Qty {item.quantity}</p>
                          <p className="text-sm font-bold text-[#26342b]">
                            ${(item.price * item.quantity).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {purchaseMethod === "mortgage" && selectedPlan ? (
                    <div className="border-t mt-6 pt-4 space-y-2">
                      <p className="text-xs font-semibold text-[#c47a45] uppercase tracking-wider flex items-center gap-1.5 mb-1">
                        <Landmark className="w-3.5 h-3.5" /> Mortgage — {selectedPlan.name}
                      </p>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Total contract value</span>
                        <span className="font-semibold text-[#26342b]">{formatCurrency(selectedPlan.totalPayable)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Down payment</span>
                        <span className="font-semibold text-[#a6632f]">{formatCurrency(selectedPlan.downPayment)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>{selectedPlan.paymentFrequency === "yearly" ? "Yearly" : "Monthly"} installment</span>
                        <span className="font-semibold text-[#c47a45]">{formatCurrency(selectedPlan.installment)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Duration</span>
                        <span>{selectedPlan.durationMonths} months</span>
                      </div>
                      <p className="text-xs text-gray-400 pt-1">
                        Nothing is charged today — your application goes to admin review first.
                      </p>
                    </div>
                  ) : (
                    <div className="border-t mt-6 pt-4 space-y-2">
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Subtotal ({totalItems} items)</span>
                        <span>${totalPrice.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Documentation & Handover</span>
                        <span className="text-green-600 font-medium">Included</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold text-[#26342b] pt-2 border-t">
                        <span>Total</span>
                        <span>${totalPrice.toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Due today (30% deposit): ${Math.round(totalPrice * 0.3).toLocaleString()}
                      </p>
                    </div>
                  )}
                  <Button
                    type="submit"
                    disabled={createOrder.isPending || applyForMortgage.isPending || (purchaseMethod === "mortgage" && !selectedPlan)}
                    className="w-full mt-6 h-12 bg-[#26342b] transition text-base font-semibold"
                  >
                    {purchaseMethod === "mortgage" ? (
                      <>
                        {applyForMortgage.isPending ? "Submitting..." : "Submit Mortgage Application"}
                        <FileText className="w-5 h-5 ml-2" />
                      </>
                    ) : (
                      <>
                        {createOrder.isPending ? "Placing Order..." : "Place Order"}
                        <CheckCircle className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-gray-400 text-center mt-3 flex items-center justify-center gap-1">
                    <Lock className="w-3 h-3" /> 256-bit SSL secured checkout
                  </p>
                </div>
              </div>
            </form>
          )}
        </div>
      </main>
      <Footer />
      <WhatsAppChat />
    </div>
  );
}
