import { Link } from "react-router";
import { ArrowLeft, Lock, CheckCircle, ShieldCheck, TrendingUp, Home } from "lucide-react";

interface InvestAuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export default function InvestAuthShell({ title, subtitle, children }: InvestAuthShellProps) {
  return (
    <div className="min-h-screen flex bg-[#f7f4ee]">
      {/* Scoped entrance animation */}
      <style>{`
        @keyframes auth-fade-up {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .auth-fade { opacity: 0; animation: auth-fade-up 0.7s ease forwards; }
        @media (prefers-reduced-motion: reduce) {
          .auth-fade { animation: none; opacity: 1; }
        }
      `}</style>

      {/* ── Left promotional panel ─────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-1/2 relative flex-col p-12 xl:p-16 text-white bg-[#192420]">
        {/* Logo */}
        <Link to="/" className="relative z-10 flex items-center gap-3 auth-fade w-fit">
          <div className="w-11 h-11 border border-white/40 flex items-center justify-center">
            <Home className="w-5 h-5 text-[#c47a45]" />
          </div>
          <div>
            <p className="text-lg font-serif tracking-[0.08em] uppercase">Nestaro Homes</p>
            <p className="text-[10px] text-white/50 tracking-[0.22em] uppercase">Home Plans</p>
          </div>
        </Link>

        {/* Headline + illustration */}
        <div className="relative z-10 my-auto py-10">
          <h1
            className="font-serif text-4xl xl:text-[2.9rem] leading-[1.15] auth-fade"
            style={{ animationDelay: "120ms" }}
          >
            Plan Your Tiny Home.{" "}
            <span className="text-[#c47a45]">Build Toward It</span> with Confidence.
          </h1>
          <p
            className="mt-5 text-white/70 text-lg leading-relaxed max-w-md auth-fade"
            style={{ animationDelay: "260ms" }}
          >
            Join a Home Plan and track your growing home credits through your secure
            customer dashboard.
          </p>

          <div className="auth-fade mt-10 border border-white/15 p-6" style={{ animationDelay: "400ms" }}>
            <img
              src="/images/invest-auth-illustration-v2.png"
              alt="Tiny home illustration"
              className="w-full max-w-md mx-auto"
            />
          </div>

          {/* Trust indicators */}
          <div
            className="mt-10 pt-8 border-t border-white/15 flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/60 auth-fade"
            style={{ animationDelay: "540ms" }}
          >
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#c47a45]" /> Monthly home credits
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#c47a45]" /> Bank-grade security
            </span>
            <span className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#c47a45]" /> Real home projects
            </span>
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/40 auth-fade" style={{ animationDelay: "640ms" }}>
          Portland, Oregon · Serving the United States & Europe
        </p>
      </div>

      {/* ── Right form panel ───────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-10 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Compact promo header on mobile/tablet */}
          <div className="lg:hidden flex flex-col items-center mb-8 auth-fade">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-11 h-11 border border-[#26342b] flex items-center justify-center">
                <Home className="w-5 h-5 text-[#c47a45]" />
              </div>
              <div>
                <p className="text-lg font-serif text-[#26342b] tracking-[0.08em] uppercase">Nestaro Homes</p>
                <p className="text-[10px] text-[#3d5045] tracking-[0.22em] uppercase">Home Plans</p>
              </div>
            </Link>
          </div>

          <div
            className="bg-white border border-[#e5e7eb] p-7 sm:p-10 auth-fade"
            style={{ animationDelay: "120ms" }}
          >
            <div className="mb-8">
              <h2 className="nh-display text-3xl">{title}</h2>
              <p className="text-sm text-[#3d5045] mt-2">{subtitle}</p>
            </div>

            {children}

            <div className="mt-8 pt-6 border-t border-[#e5e7eb]">
              <Link
                to="/invest"
                className="inline-flex items-center gap-2 text-sm text-[#26342b] hover:text-[#c47a45] font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Home Plans
              </Link>
            </div>
          </div>

          <p className="text-center text-xs text-[#9ca3af] mt-6 flex items-center justify-center gap-2">
            <Lock className="w-3 h-3" />
            Secured with 256-bit SSL encryption
          </p>
        </div>
      </div>
    </div>
  );
}
