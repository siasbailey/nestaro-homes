import { useState } from "react";
import { Search, Users, Ban, CheckCircle, ShieldCheck, Eye, Clock, Snowflake, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { formatCurrency, formatDate } from "@/hooks/use-investor";
import { SectionCard, StatusBadge, EmptyState, ProgressBar } from "../dashboard/shared";
import VerificationBadge from "@/components/invest/VerificationBadge";
import InvestorAvatar from "@/components/invest/InvestorAvatar";

export default function AdminInvestors() {
  const [search, setSearch] = useState("");
  const { data: investors, refetch } = trpc.investAdmin.investors.useQuery(
    { search: search || undefined },
    { retry: false, refetchInterval: 20_000 },
  );
  const [detailId, setDetailId] = useState<number | null>(null);
  const { data: detail, refetch: refetchDetail } = trpc.investAdmin.investorDetail.useQuery(
    { investorId: detailId ?? 0 },
    { enabled: detailId !== null, retry: false, refetchInterval: 20_000 },
  );

  const setStatus = trpc.investAdmin.setInvestorStatus.useMutation({
    onSuccess: () => { toast.success("Customer status updated"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const setFrozen = trpc.investAdmin.setWalletFrozen.useMutation({
    onSuccess: (_d, vars) => {
      toast.success(vars.frozen ? "Wallet frozen" : "Wallet unfrozen");
      refetch();
      refetchDetail();
    },
    onError: (err) => toast.error(err.message),
  });

  const setKyc = trpc.investAdmin.setKycStatus.useMutation({
    onSuccess: () => { toast.success("KYC status updated"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  return (
    <SectionCard
      title="Customer Management"
      subtitle={`${investors?.length ?? 0} investors`}
      action={
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email..."
            className="pl-9 w-56"
          />
        </div>
      }
    >
      {investors && investors.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b">
                <th className="pb-3 pr-4 font-semibold">Investor</th>
                <th className="pb-3 pr-4 font-semibold">Wallet</th>
                <th className="pb-3 pr-4 font-semibold">Earnings</th>
                <th className="pb-3 pr-4 font-semibold">KYC</th>
                <th className="pb-3 pr-4 font-semibold">Status</th>
                <th className="pb-3 pr-4 font-semibold">Last Login</th>
                <th className="pb-3 pr-4 font-semibold">Registered</th>
                <th className="pb-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {investors.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-[#f7f4ee] transition">
                  <td className="py-3.5 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#26342b] flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden">
                        {inv.avatar ? (
                          <img src={inv.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          inv.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[#26342b] truncate">
                          {inv.name}
                          {inv.role === "admin" && (
                            <span className="ml-2 text-[10px] font-bold uppercase bg-[#c47a45]/10 text-[#a6632f] px-2 py-0.5 rounded-full">Admin</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{inv.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 pr-4 font-bold text-[#26342b]">
                    {formatCurrency(inv.walletBalance)}
                    {inv.walletFrozen === "yes" && (
                      <span className="ml-1.5 inline-flex items-center text-[10px] font-bold uppercase text-blue-500" title="Wallet frozen">
                        <Snowflake className="w-3 h-3 mr-0.5" /> Frozen
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 pr-4 text-green-600 font-semibold">{formatCurrency(inv.totalEarnings)}</td>
                  <td className="py-3.5 pr-4">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={inv.kycStatus} />
                      {inv.kycStatus === "pending" && (
                        <div className="flex gap-1">
                          <button onClick={() => setKyc.mutate({ investorId: inv.id, status: "verified" })} className="text-xs font-semibold text-green-600 hover:underline" title={`Approve KYC for ${inv.kycFullName ?? inv.name} (${inv.kycDocumentType ?? ""} ${inv.kycIdNumber ?? ""})`}>Approve</button>
                          <button onClick={() => setKyc.mutate({ investorId: inv.id, status: "rejected" })} className="text-xs font-semibold text-red-500 hover:underline">Reject</button>
                        </div>
                      )}
                    </div>
                    {inv.verificationTier && (
                      <div className="mt-1.5">
                        <VerificationBadge tier={inv.verificationTier} status={inv.verificationStatus} size="sm" />
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 pr-4"><StatusBadge status={inv.status} /></td>
                  <td className="py-3.5 pr-4 text-gray-500 text-xs">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(inv.lastSignInAt)}</span>
                  </td>
                  <td className="py-3.5 pr-4 text-gray-500 text-xs">{formatDate(inv.createdAt)}</td>
                  <td className="py-3.5">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => setDetailId(inv.id)} className="border-[#26342b] text-[#26342b] h-8 text-xs">
                        <Eye className="w-3.5 h-3.5 mr-1" /> View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus.mutate({ investorId: inv.id, status: inv.status === "active" ? "suspended" : "active" })}
                        className={`h-8 text-xs ${inv.status === "active" ? "border-red-300 text-red-500" : "border-green-300 text-green-600"}`}
                      >
                        {inv.status === "active" ? (<><Ban className="w-3.5 h-3.5 mr-1" /> Suspend</>) : (<><CheckCircle className="w-3.5 h-3.5 mr-1" /> Activate</>)}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={Users} title="No customers found" text="Registered customers will appear here." />
      )}

      {/* Investor detail modal */}
      {detailId !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setDetailId(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-2xl my-8 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {!detail ? (
              <div className="flex justify-center py-12">
                <div className="w-10 h-10 border-4 border-[#26342b] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <InvestorAvatar name={detail.investor.name} avatar={detail.investor.avatar} size="lg" />
                    <div>
                      <h3 className="text-xl font-bold text-[#26342b] font-serif">{detail.investor.name}</h3>
                      <p className="text-sm text-gray-500">{detail.investor.email} · {detail.investor.phone || "no phone"} · {detail.investor.country || "no country"}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Registered {formatDate(detail.investor.createdAt)} · Last login {formatDate(detail.investor.lastSignInAt)} · Ref code {detail.investor.referralCode}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <StatusBadge status={detail.investor.status} />
                    <StatusBadge status={detail.investor.kycStatus} />
                  </div>
                </div>

                {/* Freeze / unfreeze wallet */}
                <div className="flex items-center justify-between bg-blue-50/60 border border-blue-100 rounded-xl px-4 py-3 mb-5">
                  <p className="text-sm text-blue-900 font-medium flex items-center gap-2">
                    <Snowflake className="w-4 h-4 text-blue-500" />
                    {detail.financials?.walletFrozen
                      ? "Wallet is frozen — withdrawals & plans blocked"
                      : "Wallet is active — freeze to block withdrawals & plans"}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={setFrozen.isPending}
                    onClick={() =>
                      setFrozen.mutate({
                        investorId: detail.investor.id,
                        frozen: !detail.financials?.walletFrozen,
                      })
                    }
                    className={
                      detail.financials?.walletFrozen
                        ? "border-green-300 text-green-600"
                        : "border-blue-300 text-blue-600"
                    }
                  >
                    {detail.financials?.walletFrozen ? (
                      <><Sun className="w-3.5 h-3.5 mr-1" /> Unfreeze Wallet</>
                    ) : (
                      <><Snowflake className="w-3.5 h-3.5 mr-1" /> Freeze Wallet</>
                    )}
                  </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                  {[
                    { label: "Wallet Balance", value: formatCurrency(detail.financials?.walletBalance ?? 0), cls: "text-[#26342b]" },
                    { label: "Available Balance", value: formatCurrency(detail.financials?.availableBalance ?? 0), cls: "text-[#26342b]" },
                    { label: "Active Plans", value: formatCurrency(detail.financials?.activeInvestments ?? 0), cls: "text-[#26342b]" },
                    { label: "Total Deposits", value: formatCurrency(detail.financials?.totalDeposits ?? 0), cls: "text-green-600" },
                    { label: "Total Withdrawals", value: formatCurrency(detail.financials?.totalWithdrawals ?? 0), cls: "text-red-500" },
                    { label: "Withdrawal Count", value: String(detail.financials?.withdrawalCount ?? 0), cls: "text-[#26342b]" },
                    { label: "Monthly ROI Paid", value: formatCurrency(detail.financials?.monthlyRoiPaid ?? 0), cls: "text-[#c47a45]" },
                    { label: "Total Profit Earned", value: formatCurrency(detail.financials?.totalProfitEarned ?? 0), cls: "text-green-600" },
                    { label: "Pending Deposits", value: String(detail.financials?.pendingDeposits ?? 0), cls: "text-amber-500" },
                    { label: "Pending Withdrawals", value: String(detail.financials?.pendingWithdrawals ?? 0), cls: "text-amber-500" },
                  ].map((c) => (
                    <div key={c.label} className="bg-[#f7f4ee] rounded-xl p-4">
                      <p className="text-xs text-gray-500">{c.label}</p>
                      <p className={`text-lg font-bold ${c.cls}`}>{c.value}</p>
                    </div>
                  ))}
                </div>

                <h4 className="font-bold text-[#26342b] mb-3">Investment History ({detail.investments.length})</h4>
                <div className="space-y-2 mb-6 max-h-52 overflow-y-auto">
                  {detail.investments.length > 0 ? detail.investments.map((inv: any) => (
                    <div key={inv.id} className="bg-[#f7f4ee] rounded-lg p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[#26342b]">#{inv.id} · {inv.projectName}</p>
                        <StatusBadge status={inv.status === "matured" ? "completed" : inv.status} />
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-gray-500">{formatCurrency(inv.amount)} · profit {formatCurrency(inv.totalProfitPaid)} · {formatDate(inv.createdAt)}</span>
                        <ProgressBar value={inv.progress} className="flex-1" />
                        <span className="text-xs font-bold text-[#26342b]">{inv.progress}%</span>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-gray-500">No investments yet.</p>
                  )}
                </div>

                <h4 className="font-bold text-[#26342b] mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#c47a45]" /> Recent Activity ({detail.activity.length})
                </h4>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {detail.activity.length > 0 ? detail.activity.map((a: any) => (
                    <div key={a.id} className="flex items-start justify-between gap-3 text-sm border-b border-gray-100 pb-2">
                      <div>
                        <p className="font-medium text-[#26342b] capitalize">{a.action.replace(/_/g, " ")}</p>
                        <p className="text-xs text-gray-500">{a.details}</p>
                        {a.ipAddress && <p className="text-[11px] text-gray-400">IP {a.ipAddress}</p>}
                      </div>
                      <p className="text-xs text-gray-400 shrink-0">{formatDate(a.createdAt)}</p>
                    </div>
                  )) : (
                    <p className="text-sm text-gray-500">No activity recorded yet.</p>
                  )}
                </div>

                <div className="mt-6 text-right">
                  <Button variant="outline" onClick={() => setDetailId(null)}>Close</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
