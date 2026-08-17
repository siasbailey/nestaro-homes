import { useEffect, useState } from "react";
import { UserCircle, Mail, KeyRound, Loader2, CheckCircle2, Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";

export default function AdminProfileSettings() {
  const meQuery = trpc.admin.adminMe.useQuery(undefined, { retry: false });
  const me = meQuery.data;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (me) {
      setFirstName(me.firstName ?? "");
      setLastName(me.lastName ?? "");
      setDisplayName(me.displayName ?? "");
      setPhone(me.phone ?? "");
      setAvatar(me.avatar ?? "");
    }
  }, [me]);

  const updateProfile = trpc.adminMgmt.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated");
      meQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const requestEmailChange = trpc.adminMgmt.requestEmailChange.useMutation({
    onSuccess: (data) => {
      if (data.emailed) {
        toast.success(`Verification link sent to ${newEmail} — your current email stays active until verified.`, { duration: 8000 });
      } else {
        toast.info(`Email service not configured — verification link: /admin/verify-email?token=${data.devToken}`, { duration: 15000 });
      }
      setNewEmail("");
      setEmailPassword("");
      meQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const changePassword = trpc.adminMgmt.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password changed — please sign in again.", { duration: 6000 });
      localStorage.removeItem("flexhavens-admin");
      window.location.href = "/admin";
    },
    onError: (err) => toast.error(err.message),
  });

  const handleAvatarFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 800_000) {
      toast.error("Please choose an image under 800KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.readAsDataURL(file);
  };

  if (meQuery.isLoading || !me) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-[#26342b] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const inputCls =
    "mt-1.5 w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c47a45]/40 focus:border-[#c47a45]";
  const labelCls = "text-xs font-semibold text-gray-500 uppercase tracking-wider";

  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      {/* Profile */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-[#26342b] font-serif flex items-center gap-2 mb-5">
          <UserCircle className="w-5 h-5 text-[#c47a45]" /> Profile Information
        </h3>

        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-full bg-[#26342b] flex items-center justify-center text-white text-xl font-bold overflow-hidden shrink-0">
            {avatar ? <img src={avatar} alt="Profile" className="w-full h-full object-cover" /> : me.displayName.charAt(0).toUpperCase()}
          </div>
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#26342b] border border-gray-200 rounded-lg px-3 py-2 hover:bg-[#f7f4ee] transition">
              <Camera className="w-4 h-4" /> Upload Photo
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatarFile(e.target.files?.[0])} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>First Name</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Last Name</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="mt-4">
          <label className={labelCls}>Display Name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputCls} />
        </div>
        <div className="mt-4">
          <label className={labelCls}>Phone Number (optional)</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+1 (555) 000-0000" />
        </div>
        <div className="mt-4">
          <label className={labelCls}>Role</label>
          <p className="mt-1.5 text-sm font-semibold text-[#26342b] capitalize">{me.role} Administrator</p>
        </div>

        <Button
          className="mt-6 bg-[#26342b]"
          disabled={updateProfile.isPending || !displayName}
          onClick={() => updateProfile.mutate({ firstName, lastName, displayName, phone, avatar })}
        >
          {updateProfile.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
          Save Profile
        </Button>
      </div>

      <div className="space-y-6">
        {/* Email change */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-[#26342b] font-serif flex items-center gap-2 mb-2">
            <Mail className="w-5 h-5 text-[#c47a45]" /> Change Email Address
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Current: <span className="font-semibold text-[#26342b]">{me.email}</span>
            {me.pendingEmail && (
              <span className="block text-xs text-amber-600 mt-1">
                Verification pending for {me.pendingEmail} — check that inbox to complete the change.
              </span>
            )}
          </p>
          <div>
            <label className={labelCls}>New Email Address</label>
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={inputCls} placeholder="new@email.com" />
          </div>
          <div className="mt-4">
            <label className={labelCls}>Confirm with Password</label>
            <input type="password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} className={inputCls} placeholder="Your current password" />
          </div>
          <Button
            variant="outline"
            className="mt-5 border-[#26342b] text-[#26342b]"
            disabled={requestEmailChange.isPending || !newEmail || !emailPassword}
            onClick={() => requestEmailChange.mutate({ newEmail, password: emailPassword })}
          >
            {requestEmailChange.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Mail className="w-4 h-4 mr-1.5" />}
            Send Verification Email
          </Button>
          <p className="text-xs text-gray-400 mt-3">
            A verification link goes to the new address; your current email is notified and stays active until the change is verified.
          </p>
        </div>

        {/* Password change */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-[#26342b] font-serif flex items-center gap-2 mb-5">
            <KeyRound className="w-5 h-5 text-[#c47a45]" /> Change Password
          </h3>
          <div>
            <label className={labelCls}>Current Password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputCls} />
          </div>
          <div className="mt-4">
            <label className={labelCls}>New Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} placeholder="Min 10 chars, letters + numbers" />
          </div>
          <div className="mt-4">
            <label className={labelCls}>Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputCls} />
          </div>
          <Button
            className="mt-6 bg-[#26342b]"
            disabled={changePassword.isPending || !currentPassword || !newPassword || !confirmPassword}
            onClick={() => changePassword.mutate({ currentPassword, newPassword, confirmPassword })}
          >
            {changePassword.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <KeyRound className="w-4 h-4 mr-1.5" />}
            Change Password
          </Button>
          <p className="text-xs text-gray-400 mt-3">
            All sessions (including this one) are signed out after a password change, and a confirmation email is sent.
          </p>
        </div>
      </div>
    </div>
  );
}
