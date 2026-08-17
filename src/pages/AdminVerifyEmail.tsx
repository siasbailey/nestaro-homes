import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CheckCircle, XCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";

export default function AdminVerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"loading" | "success" | "error" | "no-token">(
    token ? "loading" : "no-token",
  );
  const [error, setError] = useState("");

  const confirm = trpc.adminMgmt.confirmEmailChange.useMutation({
    onSuccess: () => setStatus("success"),
    onError: (err) => {
      setError(err.message);
      setStatus("error");
    },
  });

  useEffect(() => {
    if (token) confirm.mutate({ token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        backgroundImage: `linear-gradient(rgba(30, 58, 95, 0.95), rgba(30, 58, 95, 0.92)), url('/images/hero-home.jpg')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="w-14 h-14 bg-[#26342b] rounded-xl flex items-center justify-center mx-auto mb-6">
          <Shield className="w-7 h-7 text-white" />
        </div>

        {status === "loading" && (
          <>
            <div className="w-10 h-10 border-4 border-[#26342b] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Verifying your new email address...</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-[#26342b] mb-2">Email Address Updated</h3>
            <p className="text-sm text-gray-600 mb-6">
              Your new administrator email is verified and active. Use it the next time you sign in.
            </p>
            <Link to="/admin">
              <Button className="bg-[#26342b]">Go to Admin Login</Button>
            </Link>
          </>
        )}

        {(status === "error" || status === "no-token") && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-[#26342b] mb-2">Verification Failed</h3>
            <p className="text-sm text-gray-600 mb-6">
              {error || "This verification link is invalid or has expired. Please request a new one from your admin profile settings."}
            </p>
            <Link to="/admin">
              <Button variant="outline" className="border-[#26342b] text-[#26342b]">Back to Admin Login</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
