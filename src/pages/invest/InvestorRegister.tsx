import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Mail, Lock, Eye, EyeOff, User, Phone, Globe, Gift, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useInvestor } from "@/hooks/use-investor";
import InvestAuthShell from "@/components/invest/InvestAuthShell";
import { CountrySelect } from "@/components/GeoSelects";

export default function InvestorRegister() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, refetch } = useInvestor();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    country: "United States",
    referralCode: searchParams.get("ref") || "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const selectedPlan = searchParams.get("plan");

  useEffect(() => {
    if (isAuthenticated) navigate("/invest/dashboard", { replace: true });
  }, [isAuthenticated, navigate]);

  const register = trpc.investorAuth.register.useMutation({
    onSuccess: (data) => {
      toast.success("Account created! Welcome to Nestaro Homes.");
      refetch();
      if (data.devVerificationToken) {
        toast.info(
          "Email service is not configured in this environment — your verification link is pre-filled on the next page.",
          { duration: 8000 },
        );
        navigate(`/invest/verify-email?token=${data.devVerificationToken}`);
      } else {
        toast.success("We've sent a verification link to your email — check your inbox.", { duration: 6000 });
        navigate("/invest/verify-email?sent=1");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!agreed) {
      toast.error("Please accept the Terms & Conditions to continue");
      return;
    }
    register.mutate({
      name: form.name,
      email: form.email,
      password: form.password,
      phone: form.phone || undefined,
      country: form.country || undefined,
      referralCode: form.referralCode || undefined,
    });
  };

  return (
    <InvestAuthShell
      title="Create Your Account"
      subtitle={
        selectedPlan
          ? `Start your ${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} plan journey today`
          : "Join Nestaro Homes and start planning your tiny home"
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Full Name *</Label>
          <div className="relative mt-1.5">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              id="name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="John Smith"
              className="pl-10 h-11"
              autoComplete="name"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="reg-email">Email Address *</Label>
          <div className="relative mt-1.5">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              id="reg-email"
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="you@example.com"
              className="pl-10 h-11"
              autoComplete="email"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="phone">Phone</Label>
            <div className="relative mt-1.5">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="+1 555 000 0000"
                className="pl-9 h-11"
                autoComplete="tel"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="country">Country</Label>
            <div className="relative mt-1.5">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
              <CountrySelect
                id="country"
                value={form.country}
                onChange={(v) => update("country", v)}
                className="w-full h-11 rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#c47a45]/40 focus:border-[#c47a45]"
              />
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="reg-password">Password *</Label>
          <div className="relative mt-1.5">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              id="reg-password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder="Min. 8 characters, letters + numbers"
              className="pl-10 pr-10 h-11"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirm Password *</Label>
          <div className="relative mt-1.5">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={form.confirmPassword}
              onChange={(e) => update("confirmPassword", e.target.value)}
              placeholder="Repeat your password"
              className="pl-10 h-11"
              autoComplete="new-password"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="referralCode" className="flex items-center gap-1.5">
            <Gift className="w-4 h-4 text-[#c47a45]" />
            Referral Code (optional)
          </Label>
          <Input
            id="referralCode"
            value={form.referralCode}
            onChange={(e) => update("referralCode", e.target.value.toUpperCase())}
            placeholder="e.g. JOHN1234"
            className="mt-1.5 h-11 uppercase"
          />
        </div>

        <label className="flex items-start gap-3 text-sm text-gray-600 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 w-4 h-4 accent-[#26342b]"
          />
          <span>
            I agree to the{" "}
            <Link to="/terms-conditions" className="text-[#c47a45] font-medium hover:underline">
              Terms &amp; Conditions
            </Link>{" "}
            and{" "}
            <Link to="/invest#risk-disclosure" className="text-[#c47a45] font-medium hover:underline">
              Risk Disclosure
            </Link>
            , and understand that target returns are not guaranteed.
          </span>
        </label>

        <Button
          type="submit"
          disabled={register.isPending}
          className="w-full h-12 bg-[#c47a45] transition text-base font-semibold"
        >
          {register.isPending ? "Creating Account..." : "Create Account"}
          <CheckCircle className="w-5 h-5 ml-2" />
        </Button>

        <p className="text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link to="/invest/login" className="text-[#26342b] hover:text-[#3d5045] font-semibold">
            Sign in
          </Link>
        </p>
      </form>
    </InvestAuthShell>
  );
}
