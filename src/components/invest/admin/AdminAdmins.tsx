import { useState } from "react";
import { formatDateTime } from "@/hooks/use-investor";
import {
  ShieldCheck, Shield, UserPlus, Pencil, KeyRound, Ban, CheckCircle2, Trash2,
  X, Loader2, Activity, Crown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { AdminPermissions } from "@contracts/constants";

type AdminRow = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  email: string;
  phone: string | null;
  role: "primary" | "secondary";
  permissions: string[];
  status: "active" | "suspended";
  lastSignInAt: string | Date | null;
  createdAt: string | Date;
};

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return formatDateTime(d);
}

function PermissionPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (key: string) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  return (
    <div className="grid grid-cols-2 gap-2">
      {AdminPermissions.map((p) => (
        <label
          key={p.key}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition ${
            value.includes(p.key)
              ? "border-[#c47a45] bg-[#c47a45]/10 text-[#26342b] font-semibold"
              : "border-gray-200 text-gray-600 hover:border-gray-300"
          }`}
        >
          <input
            type="checkbox"
            checked={value.includes(p.key)}
            onChange={() => toggle(p.key)}
            className="accent-[#26342b]"
          />
          {p.label}
        </label>
      ))}
    </div>
  );
}

export default function AdminAdmins() {
  const adminsQuery = trpc.adminMgmt.listAdmins.useQuery(undefined, { retry: false, refetchInterval: 20_000 });
  const activityQuery = trpc.adminMgmt.adminActivity.useQuery(undefined, { retry: false });
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AdminRow | null>(null);
  const [showActivity, setShowActivity] = useState(false);

  // create form state
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPassword, setCPassword] = useState("");
  const [cPerms, setCPerms] = useState<string[]>([]);

  // edit form state
  const [eName, setEName] = useState("");
  const [eRole, setERole] = useState<"primary" | "secondary">("secondary");
  const [ePerms, setEPerms] = useState<string[]>([]);

  const invalidate = () => {
    adminsQuery.refetch();
    activityQuery.refetch();
  };

  const create = trpc.adminMgmt.createAdmin.useMutation({
    onSuccess: () => {
      toast.success("Administrator created");
      setShowCreate(false);
      setCName(""); setCEmail(""); setCPassword(""); setCPerms([]);
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const update = trpc.adminMgmt.updateAdmin.useMutation({
    onSuccess: () => {
      toast.success("Administrator updated — permissions take effect immediately");
      setEditing(null);
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const setStatus = trpc.adminMgmt.setAdminStatus.useMutation({
    onSuccess: (_d, v) => {
      toast.success(v.status === "suspended" ? "Administrator suspended" : "Administrator reactivated");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const resetPw = trpc.adminMgmt.resetAdminPassword.useMutation({
    onSuccess: () => toast.success("Password reset — all their sessions were signed out"),
    onError: (err) => toast.error(err.message),
  });

  const remove = trpc.adminMgmt.deleteAdmin.useMutation({
    onSuccess: () => {
      toast.success("Administrator removed");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const openEdit = (a: AdminRow) => {
    setEditing(a);
    setEName(a.displayName);
    setERole(a.role);
    setEPerms(a.permissions);
  };

  const busy = create.isPending || update.isPending || setStatus.isPending || remove.isPending;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-lg font-bold text-[#26342b] font-serif">Administrators</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              The Primary Admin has unrestricted access. Secondary admins only see their assigned sections.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowActivity(!showActivity)}>
              <Activity className="w-4 h-4 mr-1.5" /> Activity Log
            </Button>
            <Button size="sm" className="bg-[#26342b]" onClick={() => setShowCreate(true)}>
              <UserPlus className="w-4 h-4 mr-1.5" /> Add Administrator
            </Button>
          </div>
        </div>

        {adminsQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-[#26342b] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {(adminsQuery.data ?? []).map((a) => (
              <div key={a.id} className="bg-[#f7f4ee] rounded-xl p-5 border border-gray-100">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold ${
                      a.role === "primary" ? "bg-[#c47a45]" : "bg-[#26342b]"
                    }`}>
                      {a.role === "primary" ? <Crown className="w-5 h-5" /> : a.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-[#26342b] flex items-center gap-2">
                        {a.displayName}
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          a.role === "primary" ? "bg-[#c47a45]/15 text-[#a6632f]" : "bg-[#26342b]/10 text-[#26342b]"
                        }`}>
                          {a.role}
                        </span>
                        {a.status === "suspended" && (
                          <span className="text-[10px] font-bold uppercase bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                            suspended
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">{a.email}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Last sign-in: {fmtDate(a.lastSignInAt)}
                        {a.role === "secondary" && (
                          <> · Permissions: {a.permissions.length ? a.permissions.join(", ") : "none"}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openEdit(a as AdminRow)}>
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      disabled={busy}
                      onClick={() => {
                        const pw = window.prompt(`New password for ${a.displayName} (min 10 chars, letters + numbers):`);
                        if (pw) resetPw.mutate({ adminId: a.id, newPassword: pw });
                      }}
                    >
                      <KeyRound className="w-3.5 h-3.5 mr-1" /> Reset Password
                    </Button>
                    {a.status === "active" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-amber-300 text-amber-600"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm(`Suspend ${a.displayName}? They will be signed out immediately.`))
                            setStatus.mutate({ adminId: a.id, status: "suspended" });
                        }}
                      >
                        <Ban className="w-3.5 h-3.5 mr-1" /> Suspend
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-green-300 text-green-600"
                        disabled={busy}
                        onClick={() => setStatus.mutate({ adminId: a.id, status: "active" })}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Reactivate
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-red-300 text-red-500"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Permanently remove ${a.displayName}? This cannot be undone.`))
                          remove.mutate({ adminId: a.id });
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity log */}
      {showActivity && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-[#26342b] font-serif mb-4">Administrator Activity Log</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b">
                  <th className="pb-3 pr-4 font-semibold">Administrator</th>
                  <th className="pb-3 pr-4 font-semibold">Action</th>
                  <th className="pb-3 pr-4 font-semibold">Details</th>
                  <th className="pb-3 pr-4 font-semibold">IP Address</th>
                  <th className="pb-3 pr-4 font-semibold">Device</th>
                  <th className="pb-3 font-semibold">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(activityQuery.data ?? []).map((log) => (
                  <tr key={log.id} className="hover:bg-[#f7f4ee]">
                    <td className="py-3 pr-4 font-semibold text-[#26342b]">{log.adminName}</td>
                    <td className="py-3 pr-4">
                      <span className="bg-[#26342b]/5 text-[#26342b] text-xs font-semibold px-2 py-1 rounded-full">
                        {log.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-600 text-xs max-w-72"><span className="line-clamp-2">{log.details}</span></td>
                    <td className="py-3 pr-4 text-gray-500 text-xs font-mono">{log.ipAddress ?? "—"}</td>
                    <td className="py-3 pr-4 text-gray-500 text-xs max-w-48"><span className="line-clamp-1" title={log.userAgent ?? ""}>{log.userAgent ?? "—"}</span></td>
                    <td className="py-3 text-gray-600 text-xs whitespace-nowrap">{fmtDate(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-[#26342b] font-serif flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#c47a45]" /> Add Administrator
              </h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Display Name</label>
                <input value={cName} onChange={(e) => setCName(e.target.value)} className="mt-1.5 w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c47a45]/40 focus:border-[#c47a45]" placeholder="e.g. Jane Smith" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email Address</label>
                <input type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} className="mt-1.5 w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c47a45]/40 focus:border-[#c47a45]" placeholder="jane@nestarohomes.com" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Temporary Password</label>
                <input type="text" value={cPassword} onChange={(e) => setCPassword(e.target.value)} className="mt-1.5 w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c47a45]/40 focus:border-[#c47a45]" placeholder="Min 10 chars, letters + numbers" />
                <p className="text-xs text-gray-400 mt-1">Share this with the admin — they can change it in their profile settings.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Permissions</label>
                <PermissionPicker value={cPerms} onChange={setCPerms} />
                <p className="text-xs text-gray-400 mt-2">
                  Investment platform areas (investors, wallets, deposits, withdrawals, ROI, liquidations, financial reports, admin management) always remain Primary-only.
                </p>
              </div>
              <Button
                className="w-full bg-[#26342b]"
                disabled={create.isPending || !cName || !cEmail || !cPassword}
                onClick={() => create.mutate({ displayName: cName, email: cEmail, password: cPassword, permissions: cPerms as any })}
              >
                {create.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1.5" />}
                Create Administrator
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-[#26342b] font-serif flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#c47a45]" /> Edit Administrator
              </h3>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500">{editing.email}</p>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Display Name</label>
                <input value={eName} onChange={(e) => setEName(e.target.value)} className="mt-1.5 w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c47a45]/40 focus:border-[#c47a45]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Role</label>
                <div className="flex gap-2">
                  {(["primary", "secondary"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setERole(r)}
                      className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-semibold capitalize transition ${
                        eRole === r ? "border-[#26342b] bg-[#26342b] text-white" : "border-gray-200 text-gray-600"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                {eRole === "primary" && (
                  <p className="text-xs text-amber-600 mt-2">Primary admins get unrestricted access to the entire platform.</p>
                )}
              </div>
              {eRole === "secondary" && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Permissions</label>
                  <PermissionPicker value={ePerms} onChange={setEPerms} />
                </div>
              )}
              <Button
                className="w-full bg-[#26342b]"
                disabled={update.isPending || !eName}
                onClick={() =>
                  update.mutate({
                    adminId: editing.id,
                    displayName: eName,
                    role: eRole,
                    permissions: eRole === "secondary" ? (ePerms as any) : [],
                  })
                }
              >
                {update.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
