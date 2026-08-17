import { createContext, useContext, type ReactNode } from "react";
import { trpc } from "@/providers/trpc";
import type { Investor } from "@contracts/types";

export type InvestorMe = Omit<Investor, "passwordHash">;

interface InvestorContextType {
  investor: InvestorMe | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  /** Auth check failed for a NON-auth reason (network/5xx) — not a logged-out state */
  isError: boolean;
  /** Auth check was rejected as unauthenticated (401/403) — safe to redirect to login */
  isUnauthorized: boolean;
  refetch: () => Promise<unknown>;
  logout: () => void;
}

const InvestorContext = createContext<InvestorContextType | null>(null);

export function InvestorProvider({ children }: { children: ReactNode }) {
  const meQuery = trpc.investorAuth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const logoutMutation = trpc.investorAuth.logout.useMutation({
    onSettled: () => {
      meQuery.refetch();
    },
  });

  // After logout the refetch fails with 401 — react-query keeps the old data,
  // so auth state must consider the query status, not just cached data.
  const authed = !!meQuery.data && meQuery.status !== "error";

  // Distinguish "session says logged out" (401/403) from transient API
  // failures (network, 5xx) — the latter must not bounce the user to login.
  const errData = (meQuery.error as any)?.data as { httpStatus?: number; code?: string } | undefined;
  const isUnauthorized =
    meQuery.isError &&
    (errData?.httpStatus === 401 ||
      errData?.httpStatus === 403 ||
      errData?.code === "UNAUTHORIZED" ||
      errData?.code === "FORBIDDEN");

  const value: InvestorContextType = {
    investor: authed ? meQuery.data : undefined,
    isLoading: meQuery.isLoading,
    isAuthenticated: authed,
    isAdmin: authed && meQuery.data?.role === "admin",
    isError: meQuery.isError,
    isUnauthorized,
    refetch: () => meQuery.refetch(),
    logout: () => logoutMutation.mutate(),
  };

  return <InvestorContext.Provider value={value}>{children}</InvestorContext.Provider>;
}

export function useInvestor() {
  const context = useContext(InvestorContext);
  if (!context) throw new Error("useInvestor must be used within InvestorProvider");
  return context;
}

// ── US localization ─────────────────────────────────────────────
// Platform default currency: US Dollar ($). Display-only — no
// conversion is applied to stored values.
export function formatCurrency(value: number | string) {
  const num = typeof value === "string" ? Number(value) : value;
  return `${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Whole-number variant for catalog prices and large amounts ($125,000).
export function formatCurrencyWhole(value: number | string) {
  const num = typeof value === "string" ? Number(value) : value;
  return `${num.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

const PACIFIC = "America/Los_Angeles";

// US standard date: MM/DD/YYYY (America/Los_Angeles · Pacific Time)
export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", { timeZone: PACIFIC });
}

// MM/DD/YYYY hh:mm AM/PM in America/Los_Angeles time
export function formatDateTime(date: Date | string) {
  const d = new Date(date);
  const day = d.toLocaleDateString("en-US", { timeZone: PACIFIC });
  const time = d.toLocaleTimeString("en-US", {
    timeZone: PACIFIC,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${day} ${time}`;
}
