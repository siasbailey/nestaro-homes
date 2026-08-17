import { MessageSquareOff } from "lucide-react";
import { formatDateTime } from "@/hooks/use-investor";
import { trpc } from "@/providers/trpc";

function fmtDate(d: string | Date) {
  return formatDateTime(d);
}

export default function AdminDeletionFeedback() {
  const feedbackQuery = trpc.adminMgmt.deletionFeedback.useQuery(undefined, {
    retry: false,
    refetchInterval: 30_000,
  });
  const rows = feedbackQuery.data ?? [];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-[#26342b] font-serif">Account Deletion Feedback</h3>
        <p className="text-sm text-gray-500 mt-0.5">
          Reasons investors gave when permanently deleting their accounts. Visible only to the Primary Admin.
        </p>
      </div>

      {feedbackQuery.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-4 border-[#26342b] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquareOff className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-[#26342b]">No deletion feedback yet</p>
          <p className="text-sm text-gray-500 mt-1">When investors delete their accounts, their feedback appears here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="bg-[#f7f4ee] rounded-xl p-5 border border-gray-100">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-bold text-[#26342b]">{r.name}</p>
                  <p className="text-xs text-gray-400">{r.email}</p>
                </div>
                <span className="text-xs text-gray-500">{fmtDate(r.createdAt)}</span>
              </div>
              <p className="text-sm">
                <span className="font-semibold text-[#a6632f]">Reason:</span>{" "}
                <span className="text-gray-700">{r.reason}</span>
              </p>
              {r.comment && (
                <div className="mt-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                  <p className="text-sm text-gray-600">{r.comment}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
