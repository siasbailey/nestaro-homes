import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useInvestor } from "@/hooks/use-investor";
import InvestAuthShell from "@/components/invest/InvestAuthShell";

export default function InvestorLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, refetch } = useInvestor();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    if (isAuthenticated) navigate("/invest/dashboard", { replace: true });
  }, [isAuthenticated, navigate]);

  const login = trpc.investorAuth.login.useMutation({
    onSuccess: async () => {
      toast.success("Welcome back!");
      // Store/restore auth state BEFORE navigating — otherwise the dashboard
      // mounts while the session query is still stale and can bounce or blank.
      await refetch();
      const next = searchParams.get("next") || "/invest/dashboard";
      // Replace the login entry — Back should not return to the login form
      navigate(next, { replace: true });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter your email and password");
      return;
    }
    login.mutate({ email, password, remember });
  };

  return (
    <InvestAuthShell title="Welcome Back" subtitle="Enter your credentials to access your customer dashboard">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <Label htmlFor="email">Email Address</Label>
          <div className="relative mt-1.5">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="pl-10 h-12"
              autoComplete="email"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <div className="relative mt-1.5">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="pl-10 pr-10 h-12"
              autoComplete="current-password"
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

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 accent-[#26342b]"
            />
            Remember me
          </label>
          <Link
            to="/invest/forgot-password"
            className="text-sm text-[#c47a45] hover:text-[#a6632f] font-medium"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          disabled={login.isPending}
          className="w-full h-12 bg-[#26342b] transition text-base font-semibold"
        >
          {login.isPending ? "Signing in..." : "Sign In"}
        </Button>

        <p className="text-center text-sm text-gray-600">
          New to Nestaro Homes?{" "}
          <Link to="/invest/register" className="text-[#c47a45] hover:text-[#a6632f] font-semibold">
            Create an account
          </Link>
        </p>
      </form>
    </InvestAuthShell>
  );
}
