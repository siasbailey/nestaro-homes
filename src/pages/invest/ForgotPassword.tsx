import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Mail, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import InvestAuthShell from "@/components/invest/InvestAuthShell";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const forgot = trpc.investorAuth.forgotPassword.useMutation({
    onSuccess: (data) => {
      setSent(true);
      if (data.devResetToken) {
        toast.info(
          "Email service is not configured in this environment — continuing directly to the reset page.",
          { duration: 6000 },
        );
        navigate(`/invest/reset-password?token=${data.devResetToken}`);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }
    forgot.mutate({ email });
  };

  return (
    <InvestAuthShell title="Reset Password" subtitle="We'll email you a secure reset link">
      {sent ? (
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-[#26342b] mb-2">Check Your Email</h3>
          <p className="text-sm text-gray-600 mb-6">
            If an account exists for <span className="font-semibold">{email}</span>, a password
            reset link is on its way. The link expires in 1 hour.
          </p>
          <Link to="/invest/login">
            <Button variant="outline" className="border-[#26342b] text-[#26342b]">
              Back to Login
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="reset-email">Email Address</Label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="pl-10 h-12"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={forgot.isPending}
            className="w-full h-12 bg-[#26342b] transition text-base font-semibold"
          >
            {forgot.isPending ? "Sending..." : "Send Reset Link"}
          </Button>

          <p className="text-center text-sm text-gray-600">
            Remembered it?{" "}
            <Link to="/invest/login" className="text-[#c47a45] hover:text-[#a6632f] font-semibold">
              Back to login
            </Link>
          </p>
        </form>
      )}
    </InvestAuthShell>
  );
}
