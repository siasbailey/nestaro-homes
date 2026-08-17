import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CheckCircle, XCircle, MailWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { useInvestor } from "@/hooks/use-investor";
import InvestAuthShell from "@/components/invest/InvestAuthShell";

export default function VerifyEmailChange() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const { refetch } = useInvestor();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "no-token">(
    token ? "loading" : "no-token",
  );
  const [errorMessage, setErrorMessage] = useState("");

  const confirm = trpc.investorAuth.confirmEmailChange.useMutation({
    onSuccess: () => {
      setStatus("success");
      refetch();
    },
    onError: (err) => {
      setStatus("error");
      setErrorMessage(err.message);
    },
  });

  const fired = useRef(false);

  useEffect(() => {
    if (token && !fired.current) {
      fired.current = true;
      confirm.mutate({ token });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <InvestAuthShell title="Email Change Verification" subtitle="Confirming your new email address">
      <div className="text-center py-4">
        {status === "loading" && (
          <>
            <div className="w-16 h-16 border-4 border-[#26342b] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Verifying your new email address...</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-[#26342b] mb-2">Email Address Changed!</h3>
            <p className="text-sm text-gray-600 mb-6">
              Your new email address has been verified and is now your sign-in email. A
              confirmation has been sent to both your old and new addresses.
            </p>
            <Link to="/invest/dashboard?tab=settings">
              <Button className="bg-[#26342b]">
                Go to Settings
              </Button>
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-[#26342b] mb-2">Verification Failed</h3>
            <p className="text-sm text-gray-600 mb-6">{errorMessage}</p>
            <Link to="/invest/dashboard?tab=settings">
              <Button variant="outline" className="border-[#26342b] text-[#26342b]">
                Go to Settings
              </Button>
            </Link>
          </>
        )}

        {status === "no-token" && (
          <>
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MailWarning className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-[#26342b] mb-2">No Verification Token</h3>
            <p className="text-sm text-gray-600 mb-6">
              This page expects a verification link from your email. You can request an email
              change from your dashboard settings.
            </p>
            <Link to="/invest/login">
              <Button variant="outline" className="border-[#26342b] text-[#26342b]">
                Go to Login
              </Button>
            </Link>
          </>
        )}
      </div>
    </InvestAuthShell>
  );
}
