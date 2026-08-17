import { Users } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { formatCurrency, formatDate } from "@/hooks/use-investor";
import { SectionCard, StatusBadge, EmptyState } from "../dashboard/shared";

// ── Referrals overview ──────────────────────────────────────────
export function AdminReferrals() {
  const { data: referrals } = trpc.investAdmin.referrals.useQuery(undefined, { retry: false, refetchInterval: 20_000 });

  return (
    <SectionCard title="Referral Program" subtitle={`${referrals?.length ?? 0} referral records`}>
      {referrals && referrals.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b">
                <th className="pb-3 pr-4 font-semibold">Referrer</th>
                <th className="pb-3 pr-4 font-semibold">Referred Investor</th>
                <th className="pb-3 pr-4 font-semibold">Bonus</th>
                <th className="pb-3 pr-4 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {referrals.map((r: any) => (
                <tr key={r.id} className="hover:bg-[#f7f4ee] transition">
                  <td className="py-3.5 pr-4">
                    <p className="font-semibold text-[#26342b]">{r.referrerName}</p>
                    <p className="text-xs text-gray-400">{r.referrerEmail}</p>
                  </td>
                  <td className="py-3.5 pr-4 text-gray-600">{r.referredName}</td>
                  <td className="py-3.5 pr-4 font-bold text-green-600">
                    {Number(r.bonusAmount) > 0 ? formatCurrency(r.bonusAmount) : "—"}
                  </td>
                  <td className="py-3.5 pr-4">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="py-3.5 text-gray-500">{formatDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={Users} title="No referrals yet" text="Referral activity will appear here." />
      )}
    </SectionCard>
  );
}
