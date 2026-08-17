import { useState } from "react";
import { useNavigate } from "react-router";
import {
  User, Lock, ShieldCheck, Download, MailCheck, MailWarning, FileText, Trash2, Camera, Check,
  MailPlus, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useInvestor, formatCurrency, formatDate } from "@/hooks/use-investor";
import { SectionCard, StatusBadge } from "./shared";
import { VerificationBadgeStrip } from "@/components/invest/VerificationBadge";
import DeleteAccountDialog from "./DeleteAccountDialog";
import WithdrawalAccountsCard from "./WithdrawalAccountsCard";
import InvestorAvatar from "@/components/invest/InvestorAvatar";
import { CountrySelect } from "@/components/GeoSelects";

export default function SettingsTab({ investor }: { investor: any }) {
  const navigate = useNavigate();
  const { refetch } = useInvestor();
  const [profile, setProfile] = useState({
    name: investor?.name ?? "",
    phone: investor?.phone ?? "",
    country: investor?.country ?? "",
  });
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [emailChange, setEmailChange] = useState({ newEmail: "", password: "" });
  const [showDelete, setShowDelete] = useState(false);
  // Profile photo: null = no unsaved change · data URL = preview of new photo
  const [photoPending, setPhotoPending] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const handleAvatarFile = async (file: File | undefined, input?: HTMLInputElement | null) => {
    if (input) input.value = ""; // allow re-selecting the same file
    if (!file) return;
    try {
      const { optimizeAvatar } = await import("@/lib/image-utils");
      setPhotoPending(await optimizeAvatar(file));
      setConfirmRemove(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not process the image.");
    }
  };
  const [kyc, setKyc] = useState({
    fullName: investor?.kycFullName ?? "",
    documentType: "passport" as "passport" | "drivers_license" | "national_id",
    idNumber: "",
  });

  const updateProfile = trpc.investorAuth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated!");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  // Dedicated photo mutation — saving the photo syncs it across the whole
  // platform immediately (shared investor query is refetched).
  const updatePhoto = trpc.investorAuth.updateProfile.useMutation({
    onSuccess: (_data, vars) => {
      const hasPhoto = typeof vars.avatar === "string";
      toast.success(hasPhoto ? "Profile picture updated!" : "Profile picture removed.");
      setPhotoPending(null);
      setConfirmRemove(false);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const savePhoto = () => {
    if (photoPending) updatePhoto.mutate({ avatar: photoPending });
  };
  const removePhoto = () => updatePhoto.mutate({ avatar: null });

  const changePassword = trpc.investorAuth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password changed successfully!");
      setPasswords({ current: "", next: "", confirm: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  const submitKyc = trpc.investorAuth.submitKyc.useMutation({
    onSuccess: () => {
      toast.success("Verification submitted for review!");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const requestEmailChange = trpc.investorAuth.requestEmailChange.useMutation({
    onSuccess: (data, vars) => {
      if (data.devToken) {
        toast.info("Email service is not configured here — opening verification directly.", { duration: 5000 });
        navigate(`/invest/verify-email-change?token=${data.devToken}`);
      } else {
        toast.success(`Verification link sent to ${vars.newEmail}. Your current email stays active until you confirm it.`, { duration: 6000 });
      }
      setEmailChange({ newEmail: "", password: "" });
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const resendVerification = trpc.investorAuth.resendVerification.useMutation({
    onSuccess: (data) => {
      if (data.devVerificationToken) {
        toast.info("Email service is not configured here — opening verification directly.", { duration: 5000 });
        navigate(`/invest/verify-email?token=${data.devVerificationToken}`);
      } else {
        toast.success("Verification email sent!");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const statementQuery = trpc.investor.statement.useQuery(undefined, { enabled: false, retry: false });

  const downloadStatement = async () => {
    const result = await statementQuery.refetch();
    const data = result.data;
    if (!data) {
      toast.error("Could not generate statement. Please try again.");
      return;
    }
    const inv = data.investor as any;
    const lines: string[] = [
      "NESTARO HOMES INVEST — ACCOUNT STATEMENT",
      `Generated: ${formatDate(data.generatedAt as unknown as Date)}`,
      "─".repeat(60),
      `Account Holder: ${inv.name}`,
      `Email: ${inv.email}`,
      `Wallet Balance: ${formatCurrency(inv.walletBalance)}`,
      `Total Earnings: ${formatCurrency(inv.totalEarnings)}`,
      `Referral Earnings: ${formatCurrency(inv.referralEarnings)}`,
      "",
      "INVESTMENTS",
      "─".repeat(60),
      ...data.investments.map(
        (i: any) =>
          `${formatDate(i.createdAt)}  ${i.projectName}  |  ${formatCurrency(i.amount)}  |  ${i.status.toUpperCase()}  |  ROI ${Number(i.roi).toFixed(1)}%`,
      ),
      "",
      "TRANSACTIONS",
      "─".repeat(60),
      ...data.transactions.map(
        (t: any) =>
          `${formatDate(t.createdAt)}  ${t.direction === "credit" ? "+" : "-"}${formatCurrency(t.amount)}  ${t.type.toUpperCase()}  ${t.status.toUpperCase()}  ${t.description}`,
      ),
      "",
      "Nestaro Homes LLC · Portland, Oregon 97209, United States",
      "This statement is generated for informational purposes only.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nestaro-statement-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Statement downloaded!");
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="col-span-full">
        <VerificationBadgeStrip />
      </div>
      {/* Profile */}
      <SectionCard title="Profile Settings" subtitle="Your personal information">
        <div className="space-y-4">
          {/* Profile picture */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-[#f7f4ee] rounded-xl p-4 border border-gray-100">
            <InvestorAvatar name={investor?.name} avatar={photoPending ?? investor?.avatar} size="xl" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#26342b]">Profile Picture</p>
              <p className="text-xs text-gray-400 mb-2.5">
                JPG, PNG or WEBP · max 5 MB · cropped to a square and optimized automatically
              </p>
              {photoPending !== null ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={savePhoto}
                    disabled={updatePhoto.isPending}
                    className="bg-[#26342b] h-8 text-xs"
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    {updatePhoto.isPending ? "Saving..." : "Save Photo"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPhotoPending(null)}
                    disabled={updatePhoto.isPending}
                    className="h-8 text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              ) : confirmRemove ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-red-600">Remove Profile Picture?</p>
                  <p className="text-xs text-red-500 mt-0.5 mb-2.5">
                    Are you sure you want to remove your current profile picture?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmRemove(false)}
                      disabled={updatePhoto.isPending}
                      className="h-8 text-xs border-gray-300 text-gray-600"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={removePhoto}
                      disabled={updatePhoto.isPending}
                      className="h-8 text-xs bg-red-600 hover:bg-red-700"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      {updatePhoto.isPending ? "Removing..." : "Remove"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <label className="cursor-pointer">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#26342b] border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition">
                      <Camera className="w-3.5 h-3.5" />
                      {investor?.avatar ? "Change Photo" : "Upload Photo"}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleAvatarFile(e.target.files?.[0], e.target)}
                    />
                  </label>
                  {investor?.avatar && (
                    <button
                      onClick={() => setConfirmRemove(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-50 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove Photo
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="s-name">Full Name</Label>
            <Input
              id="s-name"
              value={profile.name}
              onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Email Address</Label>
            <div className="flex items-center gap-3 mt-1.5">
              <Input value={investor?.email ?? ""} disabled className="bg-gray-50" />
              {investor?.emailVerified === "yes" ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-100 px-3 py-2 rounded-lg shrink-0">
                  <MailCheck className="w-3.5 h-3.5" /> Verified
                </span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => resendVerification.mutate()}
                  disabled={resendVerification.isPending}
                  className="border-amber-400 text-amber-700 shrink-0 h-9"
                >
                  <MailWarning className="w-3.5 h-3.5 mr-1.5" />
                  Verify
                </Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="s-phone">Phone</Label>
              <Input
                id="s-phone"
                value={profile.phone}
                onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="s-country">Country</Label>
              <CountrySelect
                id="s-country"
                value={profile.country}
                onChange={(v) => setProfile((p) => ({ ...p, country: v }))}
                className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#c47a45]/40 focus:border-[#c47a45]"
              />
            </div>
          </div>
          <Button
            onClick={() => updateProfile.mutate(profile)}
            disabled={updateProfile.isPending}
            className="bg-[#26342b]"
          >
            <User className="w-4 h-4 mr-2" />
            {updateProfile.isPending ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </SectionCard>

      {/* Password */}
      <SectionCard title="Change Password" subtitle="Keep your account secure">
        <div className="space-y-4">
          <div>
            <Label htmlFor="s-current">Current Password</Label>
            <Input
              id="s-current"
              type="password"
              value={passwords.current}
              onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
              className="mt-1.5"
              autoComplete="current-password"
            />
          </div>
          <div>
            <Label htmlFor="s-next">New Password</Label>
            <Input
              id="s-next"
              type="password"
              value={passwords.next}
              onChange={(e) => setPasswords((p) => ({ ...p, next: e.target.value }))}
              placeholder="Min. 8 characters, letters + numbers"
              className="mt-1.5"
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="s-confirm">Confirm New Password</Label>
            <Input
              id="s-confirm"
              type="password"
              value={passwords.confirm}
              onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
              className="mt-1.5"
              autoComplete="new-password"
            />
          </div>
          <Button
            onClick={() => {
              if (passwords.next !== passwords.confirm) {
                toast.error("New passwords do not match");
                return;
              }
              changePassword.mutate({ currentPassword: passwords.current, newPassword: passwords.next });
            }}
            disabled={changePassword.isPending || !passwords.current || !passwords.next}
            className="bg-[#26342b]"
          >
            <Lock className="w-4 h-4 mr-2" />
            {changePassword.isPending ? "Updating..." : "Update Password"}
          </Button>
        </div>
      </SectionCard>

      {/* Email Change */}
      <SectionCard
        title="Change Email Address"
        subtitle="A verification link is sent to the new address — your current email stays active until it's verified"
      >
        <div className="space-y-4">
          {investor?.pendingEmail && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <MailWarning className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Verification pending for <span className="font-semibold">{investor.pendingEmail}</span> —
                check that inbox and click the verification link to complete the change. Requesting a new
                change below cancels the previous link.
              </p>
            </div>
          )}
          <div>
            <Label htmlFor="s-newemail">New Email Address</Label>
            <Input
              id="s-newemail"
              type="email"
              value={emailChange.newEmail}
              onChange={(e) => setEmailChange((p) => ({ ...p, newEmail: e.target.value }))}
              placeholder="you@example.com"
              className="mt-1.5"
              autoComplete="email"
            />
          </div>
          <div>
            <Label htmlFor="s-emailpw">Confirm with Password</Label>
            <Input
              id="s-emailpw"
              type="password"
              value={emailChange.password}
              onChange={(e) => setEmailChange((p) => ({ ...p, password: e.target.value }))}
              className="mt-1.5"
              autoComplete="current-password"
            />
          </div>
          <Button
            onClick={() => {
              const email = emailChange.newEmail.trim();
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                toast.error("Enter a valid email address");
                return;
              }
              requestEmailChange.mutate({ newEmail: email, password: emailChange.password });
            }}
            disabled={requestEmailChange.isPending || !emailChange.newEmail || !emailChange.password}
            className="bg-[#26342b]"
          >
            {requestEmailChange.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <MailPlus className="w-4 h-4 mr-2" />
            )}
            {requestEmailChange.isPending ? "Sending..." : "Send Verification Link"}
          </Button>
        </div>
      </SectionCard>

      {/* Saved withdrawal accounts */}
      <WithdrawalAccountsCard />

      {/* KYC */}
      <SectionCard
        title="Account Verification"
        subtitle="Unlock higher withdrawal limits"
        action={<StatusBadge status={investor?.kycStatus ?? "unverified"} />}
      >
        {investor?.kycStatus === "verified" ? (
          <div className="flex items-center gap-4 bg-green-50 border border-green-200 rounded-xl p-5">
            <ShieldCheck className="w-10 h-10 text-green-600 shrink-0" />
            <div>
              <p className="font-bold text-green-800">Identity Verified</p>
              <p className="text-sm text-green-700 mt-1">
                Your account is fully verified. Higher withdrawal limits are active.
              </p>
            </div>
          </div>
        ) : investor?.kycStatus === "pending" ? (
          <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-xl p-5">
            <ShieldCheck className="w-10 h-10 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold text-amber-800">Verification Under Review</p>
              <p className="text-sm text-amber-700 mt-1">
                We're reviewing your documents. This usually takes 1-2 business days.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {investor?.kycStatus === "rejected" && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4">
                Your previous submission was rejected. Please double-check your details and try again.
              </div>
            )}
            <div>
              <Label htmlFor="kyc-name">Full Legal Name</Label>
              <Input
                id="kyc-name"
                value={kyc.fullName}
                onChange={(e) => setKyc((k) => ({ ...k, fullName: e.target.value }))}
                placeholder="As shown on your document"
                className="mt-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="kyc-type">Document Type</Label>
                <select
                  id="kyc-type"
                  value={kyc.documentType}
                  onChange={(e) => setKyc((k) => ({ ...k, documentType: e.target.value as any }))}
                  className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="passport">Passport</option>
                  <option value="drivers_license">Driver's License</option>
                  <option value="national_id">National ID</option>
                </select>
              </div>
              <div>
                <Label htmlFor="kyc-number">Document Number</Label>
                <Input
                  id="kyc-number"
                  value={kyc.idNumber}
                  onChange={(e) => setKyc((k) => ({ ...k, idNumber: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
            </div>
            <Button
              onClick={() => submitKyc.mutate(kyc)}
              disabled={submitKyc.isPending || !kyc.fullName || !kyc.idNumber}
              className="bg-[#26342b]"
            >
              <ShieldCheck className="w-4 h-4 mr-2" />
              {submitKyc.isPending ? "Submitting..." : "Submit for Verification"}
            </Button>
          </div>
        )}
      </SectionCard>

      {/* Statements */}
      <SectionCard title="Statements & Documents" subtitle="Download your account records">
        <div className="space-y-4">
          <div className="flex items-center gap-4 bg-[#f7f4ee] rounded-xl p-5">
            <div className="w-11 h-11 bg-[#26342b] rounded-xl flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-[#c47a45]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[#26342b] text-sm">Full Account Statement</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Investments, transactions, and balances — generated on demand.
              </p>
            </div>
          </div>
          <Button
            onClick={downloadStatement}
            disabled={statementQuery.isFetching}
            variant="outline"
            className="border-[#26342b] text-[#26342b]"
          >
            <Download className="w-4 h-4 mr-2" />
            {statementQuery.isFetching ? "Generating..." : "Download Statement"}
          </Button>
          <div className="text-xs text-gray-400 space-y-1 pt-2">
            <p>Account: {investor?.email}</p>
            <p>Referral Code: {investor?.referralCode}</p>
            <p>Member since: {investor?.createdAt ? formatDate(investor.createdAt) : "—"}</p>
          </div>
        </div>
      </SectionCard>

      {/* Danger zone */}
      <div className="bg-white rounded-2xl border border-red-200 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-red-600 font-serif">Delete Account</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-md">
              Permanently delete your account and personal data. This is only possible once all
              investments are closed and your balance is withdrawn. This action cannot be undone.
            </p>
          </div>
          <Button
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50 shrink-0"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Account
          </Button>
        </div>
      </div>

      {showDelete && <DeleteAccountDialog onClose={() => setShowDelete(false)} />}
    </div>
  );
}
