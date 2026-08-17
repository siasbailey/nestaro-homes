import { useState } from "react";
import {
  Landmark, Plus, Pencil, Ban, CheckCircle2, Trash2, X, Loader2, Home,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { formatCurrency } from "@/hooks/use-investor";
import { StatusBadge } from "@/components/invest/dashboard/shared";

type PlanForm = {
  name: string;
  planType: "monthly" | "yearly";
  durationValue: string;
  downPaymentPercent: string;
  interestPercent: string;
  paymentFrequency: "monthly" | "yearly";
  gracePeriodDays: string;
  lateFeePercent: string;
};

const emptyForm: PlanForm = {
  name: "",
  planType: "monthly",
  durationValue: "12",
  downPaymentPercent: "20",
  interestPercent: "0",
  paymentFrequency: "monthly",
  gracePeriodDays: "",
  lateFeePercent: "",
};

const inputCls =
  "mt-1.5 w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c47a45]/40 focus:border-[#c47a45]";
const labelCls = "text-xs font-semibold text-gray-500 uppercase tracking-wider";

export default function AdminMortgagePlans() {
  const [view, setView] = useState<"plans" | "properties">("plans");
  const plansQuery = trpc.adminMortgage.plans.useQuery(undefined, { retry: false });
  const productsQuery = trpc.adminMortgage.mortgageProducts.useQuery(undefined, {
    retry: false,
    enabled: view === "properties",
  });

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm);

  const [editProduct, setEditProduct] = useState<any | null>(null);
  const [pEnabled, setPEnabled] = useState(false);
  const [pPlanIds, setPPlanIds] = useState<number[]>([]);
  const [pMinDown, setPMinDown] = useState("");
  const [pConditions, setPConditions] = useState("");

  const invalidate = () => {
    plansQuery.refetch();
    productsQuery.refetch();
  };

  const createPlan = trpc.adminMortgage.createPlan.useMutation({
    onSuccess: () => { toast.success("Mortgage plan created"); setShowForm(false); setForm(emptyForm); invalidate(); },
    onError: (err) => toast.error(err.message),
  });
  const updatePlan = trpc.adminMortgage.updatePlan.useMutation({
    onSuccess: () => { toast.success("Mortgage plan updated"); setShowForm(false); setEditId(null); setForm(emptyForm); invalidate(); },
    onError: (err) => toast.error(err.message),
  });
  const setStatus = trpc.adminMortgage.setPlanStatus.useMutation({
    onSuccess: (_d, v) => { toast.success(v.status === "active" ? "Plan activated" : "Plan deactivated"); invalidate(); },
    onError: (err) => toast.error(err.message),
  });
  const deletePlan = trpc.adminMortgage.deletePlan.useMutation({
    onSuccess: () => { toast.success("Plan deleted"); invalidate(); },
    onError: (err) => toast.error(err.message),
  });
  const updateProduct = trpc.adminMortgage.updateProductMortgage.useMutation({
    onSuccess: () => { toast.success("Property mortgage settings saved"); setEditProduct(null); invalidate(); },
    onError: (err) => toast.error(err.message),
  });

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({
      name: p.name,
      planType: p.planType,
      durationValue: String(p.durationValue),
      downPaymentPercent: String(p.downPaymentPercent),
      interestPercent: String(p.interestPercent),
      paymentFrequency: p.paymentFrequency,
      gracePeriodDays: p.gracePeriodDays != null ? String(p.gracePeriodDays) : "",
      lateFeePercent: p.lateFeePercent != null ? String(p.lateFeePercent) : "",
    });
    setShowForm(true);
  };

  const submitPlan = () => {
    const payload = {
      name: form.name,
      planType: form.planType,
      durationValue: Number(form.durationValue),
      downPaymentPercent: Number(form.downPaymentPercent),
      interestPercent: Number(form.interestPercent),
      paymentFrequency: form.paymentFrequency,
      gracePeriodDays: form.gracePeriodDays ? Number(form.gracePeriodDays) : null,
      lateFeePercent: form.lateFeePercent ? Number(form.lateFeePercent) : null,
    };
    if (editId) updatePlan.mutate({ ...payload, planId: editId });
    else createPlan.mutate(payload);
  };

  const openProduct = (p: any) => {
    setEditProduct(p);
    setPEnabled(p.mortgageEnabled === "yes");
    setPPlanIds(p.planIds);
    setPMinDown(p.minDownPaymentPercent ?? "");
    setPConditions(p.mortgageConditions ?? "");
  };

  const plans = plansQuery.data ?? [];
  const activePlans = plans.filter((p) => p.status === "active");
  const busy = createPlan.isPending || updatePlan.isPending;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-lg font-bold text-[#26342b] font-serif">Mortgage Plans</h3>
            <p className="text-sm text-gray-500 mt-0.5">Create plans, then assign them to properties under Property Settings.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setView("plans")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${view === "plans" ? "bg-[#26342b] text-white" : "bg-[#f7f4ee] text-gray-600"}`}
            >
              Plans
            </button>
            <button
              onClick={() => setView("properties")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${view === "properties" ? "bg-[#26342b] text-white" : "bg-[#f7f4ee] text-gray-600"}`}
            >
              Property Settings
            </button>
            <Button size="sm" className="bg-[#26342b]" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1.5" /> New Plan
            </Button>
          </div>
        </div>

        {view === "plans" ? (
          plansQuery.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 border-4 border-[#26342b] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-16">
              <Landmark className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="font-semibold text-[#26342b]">No mortgage plans yet</p>
              <p className="text-sm text-gray-500 mt-1">Create your first monthly or yearly mortgage plan.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {plans.map((p) => (
                <div key={p.id} className="bg-[#f7f4ee] rounded-xl p-5 border border-gray-100">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-[#26342b]">{p.name}</p>
                      <p className="text-xs text-gray-400">
                        {p.durationValue} {p.planType === "yearly" ? "years" : "months"} · {p.paymentFrequency} payments
                        {p.usedBy > 0 && ` · used by ${p.usedBy} mortgage${p.usedBy === 1 ? "" : "s"}`}
                      </p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-4">
                    <div className="bg-white rounded-lg py-2">
                      <p className="text-[10px] text-gray-400 uppercase">Down</p>
                      <p className="text-sm font-bold text-[#a6632f]">{p.downPaymentPercent}%</p>
                    </div>
                    <div className="bg-white rounded-lg py-2">
                      <p className="text-[10px] text-gray-400 uppercase">Interest</p>
                      <p className="text-sm font-bold text-[#26342b]">{p.interestPercent}%</p>
                    </div>
                    <div className="bg-white rounded-lg py-2">
                      <p className="text-[10px] text-gray-400 uppercase">Late Fee</p>
                      <p className="text-sm font-bold text-red-500">{p.lateFeePercent ? `${p.lateFeePercent}%` : "—"}</p>
                    </div>
                  </div>
                  {p.gracePeriodDays != null && (
                    <p className="text-xs text-gray-400 mb-3">Grace period: {p.gracePeriodDays} days</p>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-8 text-xs flex-1" onClick={() => openEdit(p)}>
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                    </Button>
                    {p.status === "active" ? (
                      <Button size="sm" variant="outline" className="h-8 text-xs border-amber-300 text-amber-600" onClick={() => setStatus.mutate({ planId: p.id, status: "inactive" })}>
                        <Ban className="w-3.5 h-3.5 mr-1" /> Deactivate
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="h-8 text-xs border-green-300 text-green-600" onClick={() => setStatus.mutate({ planId: p.id, status: "active" })}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Activate
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-red-300 text-red-500"
                      disabled={p.usedBy > 0}
                      title={p.usedBy > 0 ? "In use — deactivate instead" : "Delete plan"}
                      onClick={() => {
                        if (window.confirm(`Delete plan "${p.name}"?`)) deletePlan.mutate({ planId: p.id });
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : productsQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-[#26342b] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {(productsQuery.data ?? []).map((p) => (
              <div key={p.id} className="bg-[#f7f4ee] rounded-xl p-5 border border-gray-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#26342b] rounded-lg flex items-center justify-center">
                    <Home className="w-5 h-5 text-[#c47a45]" />
                  </div>
                  <div>
                    <p className="font-bold text-[#26342b]">{p.name}</p>
                    <p className="text-xs text-gray-400">
                      {formatCurrency(p.price)} ·{" "}
                      {p.mortgageEnabled === "yes"
                        ? `Mortgage enabled — plans: ${p.planNames.join(", ") || "none"}${p.minDownPaymentPercent ? ` · min down ${p.minDownPaymentPercent}%` : ""}`
                        : "Mortgage disabled"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={p.mortgageEnabled === "yes" ? "active" : "inactive"} />
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openProduct(p)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Mortgage Settings
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Plan form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-[#26342b] font-serif flex items-center gap-2">
                <Landmark className="w-5 h-5 text-[#c47a45]" /> {editId ? "Edit Mortgage Plan" : "New Mortgage Plan"}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Plan Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="e.g. Standard 36-Month Plan" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Plan Type</label>
                  <select value={form.planType} onChange={(e) => setForm({ ...form, planType: e.target.value as any })} className={inputCls}>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Duration ({form.planType === "yearly" ? "years" : "months"})</label>
                  <input type="number" min="1" value={form.durationValue} onChange={(e) => setForm({ ...form, durationValue: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Down Payment %</label>
                  <input type="number" min="0" max="100" step="0.5" value={form.downPaymentPercent} onChange={(e) => setForm({ ...form, downPaymentPercent: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Interest % (flat, total)</label>
                  <input type="number" min="0" max="100" step="0.5" value={form.interestPercent} onChange={(e) => setForm({ ...form, interestPercent: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Payment Frequency</label>
                  <select value={form.paymentFrequency} onChange={(e) => setForm({ ...form, paymentFrequency: e.target.value as any })} className={inputCls}>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Grace Period (days, optional)</label>
                  <input type="number" min="0" value={form.gracePeriodDays} onChange={(e) => setForm({ ...form, gracePeriodDays: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Late Fee % (optional)</label>
                <input type="number" min="0" max="100" step="0.5" value={form.lateFeePercent} onChange={(e) => setForm({ ...form, lateFeePercent: e.target.value })} className={inputCls} />
              </div>
              <Button
                className="w-full bg-[#26342b]"
                disabled={busy || !form.name || !form.durationValue}
                onClick={submitPlan}
              >
                {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                {editId ? "Save Plan" : "Create Plan"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Product mortgage settings modal */}
      {editProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditProduct(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-[#26342b] font-serif flex items-center gap-2">
                <Home className="w-5 h-5 text-[#c47a45]" /> {editProduct.name}
              </h3>
              <button onClick={() => setEditProduct(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition ${pEnabled ? "border-[#c47a45] bg-[#c47a45]/5" : "border-gray-200"}`}>
                <input type="checkbox" checked={pEnabled} onChange={(e) => setPEnabled(e.target.checked)} className="accent-[#26342b] w-4 h-4" />
                <span>
                  <span className="block text-sm font-bold text-[#26342b]">Enable Mortgage Purchase</span>
                  <span className="block text-xs text-gray-400">Shows the "Buy with Mortgage" option on this property</span>
                </span>
              </label>

              {pEnabled && (
                <>
                  <div>
                    <label className={labelCls + " block mb-2"}>Available Mortgage Plans</label>
                    {activePlans.length === 0 ? (
                      <p className="text-sm text-amber-600">No active plans — create one under the Plans tab first.</p>
                    ) : (
                      <div className="space-y-2">
                        {activePlans.map((plan) => (
                          <label key={plan.id} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm cursor-pointer transition ${pPlanIds.includes(plan.id) ? "border-[#26342b] bg-[#26342b]/5 font-semibold text-[#26342b]" : "border-gray-200 text-gray-600"}`}>
                            <input
                              type="checkbox"
                              checked={pPlanIds.includes(plan.id)}
                              onChange={() => setPPlanIds(pPlanIds.includes(plan.id) ? pPlanIds.filter((id) => id !== plan.id) : [...pPlanIds, plan.id])}
                              className="accent-[#26342b]"
                            />
                            {plan.name} <span className="text-xs text-gray-400">({plan.durationValue} {plan.planType === "yearly" ? "yr" : "mo"} · {plan.interestPercent}% interest)</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Minimum Down Payment % (optional override)</label>
                    <input type="number" min="0" max="100" step="0.5" value={pMinDown} onChange={(e) => setPMinDown(e.target.value)} className={inputCls} placeholder="Uses the plan's % if empty" />
                  </div>
                  <div>
                    <label className={labelCls}>Mortgage Conditions (optional)</label>
                    <textarea value={pConditions} onChange={(e) => setPConditions(e.target.value)} rows={3} className={inputCls + " resize-none"} placeholder="e.g. subject to credit review, insurance required..." />
                  </div>
                </>
              )}

              <Button
                className="w-full bg-[#26342b]"
                disabled={updateProduct.isPending || (pEnabled && pPlanIds.length === 0)}
                onClick={() =>
                  updateProduct.mutate({
                    productId: editProduct.id,
                    enabled: pEnabled,
                    planIds: pPlanIds,
                    minDownPaymentPercent: pMinDown ? Number(pMinDown) : null,
                    conditions: pConditions || null,
                  })
                }
              >
                {updateProduct.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                Save Settings
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
