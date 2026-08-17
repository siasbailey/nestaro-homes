import { useState } from "react";
import { Building2, Bitcoin, Smartphone, Star, Pencil, Trash2, Plus, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { SectionCard } from "./shared";

type Method = "bank" | "zelle" | "crypto";
// Legacy saved accounts may still carry the retired "opay" method.
type AnyMethod = Method | "opay";

type Account = {
  id: number;
  method: AnyMethod;
  label: string;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  cryptoNetwork: string | null;
  walletAddress: string | null;
  isDefault: "yes" | "no";
};

const METHOD_META: Record<AnyMethod, { label: string; icon: any }> = {
  bank: { label: "Bank Transfer", icon: Building2 },
  zelle: { label: "Zelle", icon: Smartphone },
  crypto: { label: "Cryptocurrency", icon: Bitcoin },
  opay: { label: "OPay (legacy)", icon: Smartphone },
};
// Methods offered when adding a new account (legacy "opay" excluded).
const SELECTABLE_METHODS: Method[] = ["bank", "zelle", "crypto"];

function summary(a: Account): string {
  if (a.method === "bank") return `${a.bankName ?? ""} • ${a.accountNumber ?? ""} • ${a.accountName ?? ""}`;
  if (a.method === "zelle" || a.method === "opay") return `${a.accountNumber ?? ""} • ${a.accountName ?? ""}`;
  return `${a.cryptoNetwork ?? ""} • ${a.walletAddress ?? ""}`;
}

const EMPTY_FORM = {
  method: "bank" as Method,
  label: "",
  bankName: "",
  accountName: "",
  accountNumber: "",
  cryptoNetwork: "",
  walletAddress: "",
  isDefault: false,
};

export default function WithdrawalAccountsCard() {
  const utils = trpc.useUtils();
  const { data: accounts } = trpc.investor.withdrawalAccounts.useQuery(undefined, { retry: false });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const refresh = () => utils.investor.withdrawalAccounts.invalidate();

  const save = trpc.investor.saveWithdrawalAccount.useMutation({
    onSuccess: () => {
      toast.success(editingId ? "Withdrawal account updated." : "Withdrawal account saved.");
      setDialogOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const remove = trpc.investor.removeWithdrawalAccount.useMutation({
    onSuccess: () => {
      toast.success("Withdrawal account removed.");
      setConfirmDeleteId(null);
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const setDefault = trpc.investor.setDefaultWithdrawalAccount.useMutation({
    onSuccess: () => {
      toast.success("Default withdrawal account updated.");
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, isDefault: (accounts ?? []).length === 0 });
    setDialogOpen(true);
  };

  const openEdit = (a: Account) => {
    setEditingId(a.id);
    setForm({
      // Legacy "opay" accounts open as Zelle — saving migrates them forward.
      method: a.method === "opay" ? "zelle" : a.method,
      label: a.label ?? "",
      bankName: a.bankName ?? "",
      accountName: a.accountName ?? "",
      accountNumber: a.accountNumber ?? "",
      cryptoNetwork: a.cryptoNetwork ?? "",
      walletAddress: a.walletAddress ?? "",
      isDefault: a.isDefault === "yes",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const payload = {
      id: editingId ?? undefined,
      method: form.method,
      label: form.label.trim() || undefined,
      bankName: form.bankName.trim() || undefined,
      accountName: form.accountName.trim() || undefined,
      accountNumber: form.accountNumber.trim() || undefined,
      cryptoNetwork: form.cryptoNetwork.trim() || undefined,
      walletAddress: form.walletAddress.trim() || undefined,
      isDefault: form.isDefault,
    };
    if (form.method === "bank" && (!payload.bankName || !payload.accountName || !payload.accountNumber)) {
      toast.error("Bank name, account name and account number are required.");
      return;
    }
    if (form.method === "zelle" && (!payload.accountName || !payload.accountNumber)) {
      toast.error("Account name and Zelle email / phone number are required.");
      return;
    }
    if (form.method === "crypto" && (!payload.cryptoNetwork || !payload.walletAddress)) {
      toast.error("Network and wallet address are required.");
      return;
    }
    save.mutate(payload);
  };

  const list = (accounts ?? []) as Account[];

  return (
    <SectionCard
      title="Withdrawal Accounts"
      subtitle="Saved bank, Zelle and crypto destinations for faster withdrawals"
      action={
        <Button size="sm" variant="outline" onClick={openAdd}>
          <Plus className="w-4 h-4 mr-1.5" /> Add Account
        </Button>
      }
    >
      {list.length === 0 ? (
        <div className="text-center py-8">
          <Wallet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#26342b]">No saved accounts yet</p>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            Save your bank, Zelle or crypto account once and select it whenever you withdraw —
            no need to re-enter the details each time.
          </p>
        </div>
      ) : (
        <div className="divide-y">
          {list.map((a) => {
            const Meta = METHOD_META[a.method];
            return (
              <div key={a.id} className="flex items-center gap-3 py-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#26342b]/[0.06] flex items-center justify-center shrink-0">
                  <Meta.icon className="w-5 h-5 text-[#26342b]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#26342b] flex items-center gap-2">
                    <span className="truncate">{a.label}</span>
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide shrink-0">{Meta.label}</span>
                    {a.isDefault === "yes" && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#c47a45] shrink-0">
                        <Star className="w-3 h-3 fill-[#c47a45]" /> Default
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{summary(a)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {a.isDefault !== "yes" && (
                    <button
                      onClick={() => setDefault.mutate({ id: a.id })}
                      disabled={setDefault.isPending}
                      title="Set as default"
                      className="p-2 rounded-lg text-gray-400 hover:text-[#c47a45] hover:bg-gray-100 transition"
                    >
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(a)}
                    title="Edit"
                    className="p-2 rounded-lg text-gray-400 hover:text-[#26342b] hover:bg-gray-100 transition"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(a.id)}
                    title="Delete"
                    className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Withdrawal Account" : "Add Withdrawal Account"}</DialogTitle>
            <DialogDescription>
              Saved accounts can be selected directly when you request a withdrawal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Method</Label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {SELECTABLE_METHODS.map((m) => {
                  const Meta = METHOD_META[m];
                  return (
                    <button
                      key={m}
                      onClick={() => setForm((f) => ({ ...f, method: m }))}
                      className={`p-3 rounded-xl border-2 text-center transition ${
                        form.method === m ? "border-[#26342b] bg-[#26342b]/[0.04]" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <Meta.icon className={`w-4 h-4 mx-auto mb-1 ${form.method === m ? "text-[#26342b]" : "text-gray-400"}`} />
                      <p className="text-[11px] font-semibold text-[#26342b]">{Meta.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label htmlFor="wa-label">Label (optional)</Label>
              <Input
                id="wa-label"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder={form.method === "bank" ? "e.g. My Chase account" : form.method === "zelle" ? "e.g. My Zelle" : "e.g. USDT wallet"}
                className="mt-1.5"
                maxLength={100}
              />
            </div>
            {form.method === "bank" && (
              <>
                <div>
                  <Label htmlFor="wa-bank">Bank Name</Label>
                  <Input id="wa-bank" value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} placeholder="e.g. Guaranty Trust Bank" className="mt-1.5" maxLength={150} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="wa-acctname">Account Name</Label>
                    <Input id="wa-acctname" value={form.accountName} onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))} placeholder="Full name" className="mt-1.5" maxLength={150} />
                  </div>
                  <div>
                    <Label htmlFor="wa-acctnum">Account Number</Label>
                    <Input id="wa-acctnum" value={form.accountNumber} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))} placeholder="10-digit number" className="mt-1.5" maxLength={40} />
                  </div>
                </div>
              </>
            )}
            {form.method === "zelle" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="wa-zellename">Account Name</Label>
                  <Input id="wa-zellename" value={form.accountName} onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))} placeholder="Full name" className="mt-1.5" maxLength={150} />
                </div>
                <div>
                  <Label htmlFor="wa-zellenum">Zelle Email / Phone</Label>
                  <Input id="wa-zellenum" value={form.accountNumber} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))} placeholder="e.g. you@email.com" className="mt-1.5" maxLength={40} />
                </div>
              </div>
            )}
            {form.method === "crypto" && (
              <>
                <div>
                  <Label htmlFor="wa-network">Network</Label>
                  <Input id="wa-network" value={form.cryptoNetwork} onChange={(e) => setForm((f) => ({ ...f, cryptoNetwork: e.target.value }))} placeholder="e.g. USDT (TRC20), BTC, ETH (ERC20)" className="mt-1.5" maxLength={80} />
                </div>
                <div>
                  <Label htmlFor="wa-address">Wallet Address</Label>
                  <Input id="wa-address" value={form.walletAddress} onChange={(e) => setForm((f) => ({ ...f, walletAddress: e.target.value }))} placeholder="Wallet address" className="mt-1.5" maxLength={255} />
                </div>
              </>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-600 select-none">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                className="rounded border-gray-300"
              />
              Set as my default withdrawal account
            </label>
            <Button onClick={handleSave} disabled={save.isPending} className="w-full bg-[#26342b]">
              {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingId ? "Save Changes" : "Save Account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={confirmDeleteId != null} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove this account?</DialogTitle>
            <DialogDescription>
              The saved account will be deleted. Past withdrawals that used it are not affected.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={remove.isPending}
              onClick={() => confirmDeleteId != null && remove.mutate({ id: confirmDeleteId })}
            >
              {remove.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
