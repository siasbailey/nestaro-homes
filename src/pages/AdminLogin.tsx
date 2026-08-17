import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Shield, Lock, ArrowLeft, Eye, EyeOff, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@flexhavens.local");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("flexhavens-admin")) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [navigate]);

  const login = trpc.admin.login.useMutation({
    onSuccess: (data) => {
      localStorage.setItem("flexhavens-admin", "true");
      toast.success(`Welcome back, ${data.admin.displayName}!`);
      // Replace the login entry — Back should not return to the login form
      navigate("/admin/dashboard", { replace: true });
    },
    onError: (err) => toast.error(err.message || "Invalid email or password"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter your admin email and password");
      return;
    }
    login.mutate({ email: email.trim(), password });
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        backgroundImage: `linear-gradient(rgba(30, 58, 95, 0.95), rgba(30, 58, 95, 0.92)), url('/images/hero-home.jpg')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-[#26342b] rounded-xl flex items-center justify-center mb-4 relative overflow-hidden">
              <Shield className="w-7 h-7 text-white" />
              <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-600 rounded-full border-2 border-white"></div>
            </div>
            <h1 className="text-2xl font-bold text-[#26342b] font-serif">Admin Portal</h1>
            <p className="text-sm text-gray-500 mt-1">Nestaro Homes Management Access</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@flexhavens.local"
                  className="pl-10 h-12"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
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

            <Button
              type="submit"
              disabled={login.isPending}
              className="w-full h-12 bg-[#26342b] transition text-base font-semibold"
            >
              {login.isPending ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-[#26342b] hover:text-[#3d5045] font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Website
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-gray-300 mt-6 flex items-center justify-center gap-2">
          <Lock className="w-3 h-3" />
          Secured with 256-bit SSL encryption
        </p>
      </div>
    </div>
  );
}
