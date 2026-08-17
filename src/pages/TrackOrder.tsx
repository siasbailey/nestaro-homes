import { useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router";
import {
  Search, CheckCircle2, Circle, Clock, XCircle, Download, FileText, CreditCard,
  FileSignature, Scale, MapPin, ScrollText, ClipboardCheck, KeyRound, Home,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Navbar from "@/components/Navbar";
import AnnouncementBar from "@/components/AnnouncementBar";
import Footer from "@/sections/Footer";
import WhatsAppChat from "@/components/WhatsAppChat";
import { trpc } from "@/providers/trpc";
import { formatCurrency, formatDate, formatDateTime } from "@/hooks/use-investor";
import { PURCHASE_STAGES, purchaseStageIndex, purchaseStageNext } from "@contracts/purchase-stages";

const stageIcons: Record<string, any> = {
  purchase_request: FileText,
  payment_verification: CreditCard,
  purchase_agreement: FileSignature,
  legal_documentation: Scale,
  property_allocation: MapPin,
  title_documentation: ScrollText,
  final_inspection: ClipboardCheck,
  handover_preparation: Home,
  handed_over: KeyRound,
};

export default function TrackOrder() {
  const [searchParams] = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(searchParams.get("order") || "");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [query, setQuery] = useState<{ orderNumber: string; email: string } | null>(
    searchParams.get("order") && searchParams.get("email")
      ? { orderNumber: searchParams.get("order")!, email: searchParams.get("email")! }
      : null,
  );

  const trackQuery = trpc.orders.track.useQuery(query!, { enabled: !!query, retry: false });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderNumber.trim() && email.trim()) {
      setQuery({ orderNumber: orderNumber.trim(), email: email.trim() });
    }
  };

  const tracking = trackQuery.data;

  // Latest history entry per stage → date updated + admin note
  const stageInfo = useMemo(() => {
    const map: Record<string, { date: string; note?: string | null }> = {};
    for (const h of tracking?.history ?? []) {
      map[h.status] = { date: h.createdAt as unknown as string, note: h.note };
    }
    return map;
  }, [tracking]);

  const currentIdx = tracking ? purchaseStageIndex(tracking.order.orderStatus) : -1;
  const cancelled = tracking?.order.orderStatus === "cancelled";
  const nextStep = tracking && !cancelled ? purchaseStageNext(tracking.order.orderStatus) : null;

  return (
    <div className="min-h-screen bg-[#f7f4ee]">
      <Navbar />
      <AnnouncementBar />
      <main className="pt-32 pb-24">
        <div className="max-w-3xl mx-auto px-6 sm:px-8">
          <div className="mb-14">
            <p className="nh-label mb-5">Purchase Progress</p>
            <h1 className="nh-display text-4xl md:text-5xl mb-4">Track Your Property Purchase</h1>
            <p className="text-[#3d5045] leading-relaxed max-w-xl">
              Follow every stage of your purchase — from request to documentation to handover.
            </p>
          </div>

          {/* Search */}
          <div className="bg-white border border-[#e5e7eb] p-7 sm:p-9 mb-10">
            <form onSubmit={handleSubmit} className="space-y-7">
              <div>
                <Label htmlFor="orderNumber" className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#3d5045]">Order Number *</Label>
                <Input
                  id="orderNumber"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="NH-US-2026-XXXXX"
                  className="mt-2 rounded-none border-0 border-b border-[#e0b48c] bg-transparent px-0 focus-visible:ring-0 focus-visible:border-[#26342b]"
                  required
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#3d5045]">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-2 rounded-none border-0 border-b border-[#e0b48c] bg-transparent px-0 focus-visible:ring-0 focus-visible:border-[#26342b]"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={trackQuery.isFetching}
                className="w-full inline-flex items-center justify-center gap-3 bg-[#26342b] text-white px-8 py-4 text-[13px] font-medium uppercase tracking-[0.14em] hover:bg-[#192420] transition-colors disabled:opacity-60"
              >
                <Search className="w-4 h-4" />
                {trackQuery.isFetching ? "Searching..." : "Track Purchase"}
              </button>
            </form>
          </div>

          {trackQuery.isError && (
            <div className="bg-red-50 border border-red-200 p-5 text-center text-red-600 text-sm">
              Purchase not found. Please check your order number and email address.
            </div>
          )}

          {tracking && (
            <div className="space-y-6">
              {/* Order summary */}
              <div className="bg-white border border-[#e5e7eb] p-7">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Order</p>
                    <p className="text-lg font-bold text-[#26342b] font-mono">{tracking.order.orderNumber}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Submitted {formatDate(tracking.order.createdAt)}</p>
                  </div>
                  <span className={`text-[11px] font-medium uppercase tracking-[0.14em] px-3 py-2 ${
                    cancelled ? "bg-red-100 text-red-600" :
                    currentIdx === 8 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {cancelled ? "Cancelled" : currentIdx === 8 ? "Completed" : "In Progress"}
                  </span>
                </div>
                <div className="space-y-3 border-t border-[#e5e7eb] pt-5">
                  {tracking.items.map((item: any) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-gray-600">{item.productName} × {item.quantity}</span>
                      <span className="font-semibold text-[#26342b]">${formatCurrency(item.totalPrice)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-[#e5e7eb] pt-3">
                    <span className="font-medium text-[#192420]">Total</span>
                    <span className="font-serif text-2xl text-[#192420]">${formatCurrency(tracking.order.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Payment method</span>
                    <span className="capitalize">{tracking.order.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Payment status</span>
                    <span className={`capitalize font-semibold ${tracking.order.paymentStatus === "confirmed" ? "text-green-600" : "text-amber-600"}`}>
                      {tracking.order.paymentStatus.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              </div>

              {cancelled ? (
                <div className="bg-red-50 border border-red-200 p-8 text-center">
                  <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                  <h2 className="font-bold text-red-600 text-lg mb-1">Purchase Cancelled</h2>
                  <p className="text-sm text-red-500">This purchase has been cancelled. Please contact support if you have questions.</p>
                </div>
              ) : (
                <>
                  {/* Current stage highlight */}
                  {currentIdx >= 0 && (
                    <div className="bg-[#192420] p-8 text-white">
                      <p className="nh-label mb-3">Current Stage {currentIdx + 1} of 9</p>
                      <h2 className="font-serif text-3xl mb-2">{PURCHASE_STAGES[currentIdx].label}</h2>
                      <p className="text-white/75 text-sm mb-3">{PURCHASE_STAGES[currentIdx].description}</p>
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                        {stageInfo[tracking.order.orderStatus] && (
                          <p className="text-white/60">
                            Updated: <span className="text-white font-semibold">{formatDateTime(stageInfo[tracking.order.orderStatus].date)}</span>
                          </p>
                        )}
                        {nextStep && (
                          <p className="text-white/60">
                            Estimated next step: <span className="text-[#c47a45] font-semibold">{nextStep}</span>
                          </p>
                        )}
                      </div>
                      {/* progress bar */}
                      <div className="mt-6 h-px bg-white/20 overflow-hidden">
                        <div
                          className="h-full bg-[#c47a45] transition-all duration-700"
                          style={{ width: `${((currentIdx + 1) / 9) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* 9-stage timeline */}
                  <div className="bg-white border border-[#e5e7eb] p-7">
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#3d5045] mb-6">Purchase Timeline</p>
                    <div className="space-y-0">
                      {PURCHASE_STAGES.map((stage, i) => {
                        const done = i < currentIdx || currentIdx === 8;
                        const current = i === currentIdx && currentIdx !== 8;
                        const info = stageInfo[stage.key];
                        const Icon = stageIcons[stage.key] ?? Circle;
                        return (
                          <div key={stage.key} className="flex gap-4">
                            {/* rail */}
                            <div className="flex flex-col items-center">
                              <div className={`w-9 h-9 border flex items-center justify-center shrink-0 ${
                                done ? "border-[#26342b] bg-[#26342b] text-white" :
                                current ? "border-[#c47a45] text-[#c47a45]" :
                                "border-[#e5e7eb] text-[#9ca3af]"
                              }`}>
                                {done ? <CheckCircle2 className="w-4 h-4" /> :
                                 current ? <Icon className="w-4 h-4" /> :
                                 <Circle className="w-4 h-4" />}
                              </div>
                              {i < 8 && <div className={`w-px flex-1 min-h-6 ${i < currentIdx ? "bg-[#26342b]" : "bg-[#e5e7eb]"}`} />}
                            </div>
                            {/* content */}
                            <div className="pb-6 min-w-0">
                              <p className={`font-medium text-sm ${done ? "text-[#192420]" : current ? "text-[#c47a45]" : "text-[#9ca3af]"}`}>
                                {i + 1}. {stage.label}
                              </p>
                              {info?.date && (done || current) && (
                                <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(info.date)}</p>
                              )}
                              {info?.note && (done || current) && (
                                <p className="text-xs text-[#3d5045] mt-2 bg-[#f7f4ee] border-l-2 border-[#c47a45] px-3 py-2">
                                  {info.note}
                                </p>
                              )}
                              {current && stage.next && (
                                <p className="text-xs text-[#a6632f] mt-1 flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" /> Next: {stage.next}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Supporting documents */}
                  <div className="bg-white border border-[#e5e7eb] p-7">
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#3d5045] mb-2">Purchase Documents</p>
                    <p className="text-xs text-[#9ca3af] mb-5">
                      Agreements, title documents, and inspection reports uploaded by our team appear here.
                    </p>
                    {tracking.documents.length === 0 ? (
                      <p className="text-sm text-[#3d5045] bg-[#f7f4ee] px-4 py-3">
                        No documents uploaded yet — they will appear as your purchase progresses.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {tracking.documents.map((d: any) => (
                          <a
                            key={d.id}
                            href={d.dataUrl}
                            download={d.name}
                            className="flex items-center gap-3 bg-[#f7f4ee] hover:bg-[#f3ede4] border-b border-[#e5e7eb] px-4 py-3 transition-colors group"
                          >
                            <FileText className="w-4 h-4 text-[#c47a45] shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[#26342b] truncate">{d.name}</p>
                              <p className="text-xs text-gray-400">Uploaded {formatDate(d.uploadedAt)}</p>
                            </div>
                            <Download className="w-4 h-4 text-gray-400 group-hover:text-[#26342b] shrink-0" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="text-center text-sm text-gray-400">
                Questions about your purchase?{" "}
                <Link to="/#contact" className="text-[#c47a45] font-semibold hover:text-[#a6632f]">Contact our team</Link>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
      <WhatsAppChat />
    </div>
  );
}
