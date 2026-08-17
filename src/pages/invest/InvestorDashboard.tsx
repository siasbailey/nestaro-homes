import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  LayoutDashboard, Briefcase, TrendingUp, ArrowDownToLine, ArrowUpFromLine,
  Receipt, Users, Bell, Settings, LogOut, Menu, X, ShieldCheck, Home,
  Coins, Calculator, CircleDollarSign, Landmark, Building2, FolderOpen, CalendarDays,
  MessageSquare, Star,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useInvestor } from "@/hooks/use-investor";
import OverviewTab from "@/components/invest/dashboard/OverviewTab";
import PortfolioTab from "@/components/invest/dashboard/PortfolioTab";
import InvestTab from "@/components/invest/dashboard/InvestTab";
import DepositTab from "@/components/invest/dashboard/DepositTab";
import WithdrawTab from "@/components/invest/dashboard/WithdrawTab";
import TransactionsTab from "@/components/invest/dashboard/TransactionsTab";
import ReferralsTab from "@/components/invest/dashboard/ReferralsTab";
import NotificationsTab from "@/components/invest/dashboard/NotificationsTab";
import SettingsTab from "@/components/invest/dashboard/SettingsTab";
import ProfitsTab from "@/components/invest/dashboard/ProfitsTab";
import CalculatorTab from "@/components/invest/dashboard/CalculatorTab";
import LiquidationsTab from "@/components/invest/dashboard/LiquidationsTab";
import MortgagesTab from "@/components/invest/dashboard/MortgagesTab";
import PurchasesTab from "@/components/invest/dashboard/PurchasesTab";
import VerificationTab from "@/components/invest/dashboard/VerificationTab";
import DocumentsTab from "@/components/invest/dashboard/DocumentsTab";
import AppointmentsTab from "@/components/invest/dashboard/AppointmentsTab";
import MessagesTab from "@/components/invest/dashboard/MessagesTab";
import TestimonialsTab from "@/components/invest/dashboard/TestimonialsTab";
import VerificationBadge from "@/components/invest/VerificationBadge";

// Sidebar is organized into logical groups; every existing tab is preserved.
type DashTab = { id: string; label: string; icon: typeof LayoutDashboard };
const tabGroups: { group: string; items: DashTab[] }[] = [
  {
    group: "Account",
    items: [
      { id: "overview", label: "Overview", icon: LayoutDashboard },
      { id: "verification", label: "Verification", icon: ShieldCheck },
      { id: "documents", label: "Documents", icon: FolderOpen },
      { id: "messages", label: "Messages", icon: MessageSquare },
      { id: "notifications", label: "Notifications", icon: Bell },
      { id: "testimonials", label: "Testimonials", icon: Star },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
  {
    group: "Home Plans",
    items: [
      { id: "invest", label: "Home Plans", icon: TrendingUp },
      { id: "portfolio", label: "My Plans", icon: Briefcase },
      { id: "profits", label: "Credits", icon: Coins },
      { id: "calculator", label: "Calculator", icon: Calculator },
      { id: "liquidations", label: "Early Withdrawals", icon: CircleDollarSign },
      { id: "referrals", label: "Referrals", icon: Users },
    ],
  },
  {
    group: "Property",
    items: [
      { id: "purchases", label: "My Property Purchases", icon: Building2 },
      { id: "mortgages", label: "My Mortgages", icon: Landmark },
      { id: "appointments", label: "Appointments", icon: CalendarDays },
    ],
  },
  {
    group: "Finance",
    items: [
      { id: "deposit", label: "Wallet", icon: ArrowDownToLine },
      { id: "transactions", label: "Wallet Activity", icon: Receipt },
      { id: "withdraw", label: "Withdraw", icon: ArrowUpFromLine },
    ],
  },
];

const tabs: DashTab[] = tabGroups.flatMap((g) => g.items);

/** True when the auth check failed for a transient (non-401/403) reason. */
function meQueryIsTransientError(isError: boolean, isUnauthorized: boolean) {
  return isError && !isUnauthorized;
}

export default function InvestorDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { investor, isLoading, isAuthenticated, isAdmin, isError, isUnauthorized, logout, refetch } = useInvestor();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Keep the visible tab in sync with the URL — this is what makes the
  // browser/device Back button move between tabs correctly.
  useEffect(() => {
    const t = searchParams.get("tab") || "overview";
    if (t !== activeTab) setActiveTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    // Redirect only when the session is genuinely absent/rejected.
    // A transient auth-API failure (network/5xx) shows a retry state instead,
    // so a blip never kicks the user out or blank-screens them.
    if (!isLoading && !isAuthenticated && !meQueryIsTransientError(isError, isUnauthorized)) {
      navigate("/invest/login?next=/invest/dashboard", { replace: true });
    }
  }, [isLoading, isAuthenticated, isError, isUnauthorized, navigate]);

  const dashboardQuery = trpc.investor.dashboard.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    refetchInterval: 15_000, // live wallet/portfolio sync
  });

  // Unread message-center conversations (badge on Messages tab).
  // NOTE: this hook must stay ABOVE the auth early-return below — calling it
  // conditionally after the return changes the hook count between renders
  // (loading → authenticated) and crashes the whole app with React #310.
  const msgUnreadQuery = trpc.message.myUnreadCount.useQuery(undefined, {
    refetchInterval: 20000,
    retry: false,
    enabled: isAuthenticated,
  });

  const refetchAll = () => {
    dashboardQuery.refetch();
    refetch();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f7f4ee] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#26342b] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (meQueryIsTransientError(isError, isUnauthorized)) {
      return (
        <div className="min-h-screen bg-[#f7f4ee] flex items-center justify-center px-4">
          <div className="max-w-sm w-full bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <h1 className="text-xl font-bold font-serif text-[#26342b] mb-2">Connection problem</h1>
            <p className="text-sm text-gray-500 mb-6">We couldn't verify your session. Check your connection and try again.</p>
            <button
              onClick={() => refetch()}
              className="w-full bg-[#26342b] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#3d5045] transition"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    // Redirect to login is already in flight via the effect above — keep a
    // branded spinner, never a blank page.
    return (
      <div className="min-h-screen bg-[#f7f4ee] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#26342b] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const unread = dashboardQuery.data?.stats?.unreadNotifications ?? 0;
  const msgUnread = msgUnreadQuery.data?.count ?? 0;
  const currentTab = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  const handleSetTab = (tab: string) => {
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (tab === activeTab) return; // no duplicate history entries
    setActiveTab(tab);
    // Push a real history entry so Back returns to the previous tab
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next);
  };

  return (
    <div className="min-h-screen bg-[#f7f4ee]">
      {/* Top bar */}
      <header className="fixed top-0 inset-x-0 bg-white/95 backdrop-blur-md border-b z-40">
        <div className="flex items-center justify-between h-16 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-gray-600" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-[#26342b] rounded-lg flex items-center justify-center relative overflow-hidden">
                <TrendingUp className="w-5 h-5 text-[#c47a45]" />
                <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white"></div>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-[#26342b] font-serif leading-tight">Nestaro Homes</h1>
                <p className="text-[10px] text-gray-400 -mt-0.5 tracking-widest uppercase">Customer Dashboard</p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/"
              className="hidden md:flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#26342b] transition"
            >
              <Home className="w-4 h-4" />
              Main Site
            </Link>
            {isAdmin && (
              <Link
                to="/admin/dashboard"
                className="flex items-center gap-1.5 text-sm font-medium text-[#a6632f] hover:text-[#c47a45] transition"
              >
                <ShieldCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Admin Panel</span>
              </Link>
            )}
            <button
              onClick={() => handleSetTab("notifications")}
              className="relative p-2 text-gray-500 hover:text-[#26342b] transition"
            >
              <Bell className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#c47a45] text-white text-[10px] w-4.5 h-4.5 w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2.5 pl-2 sm:pl-4 border-l">
              <div className="w-9 h-9 rounded-full bg-[#26342b] flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                {investor?.avatar ? (
                  <img src={investor.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  investor?.name?.charAt(0).toUpperCase()
                )}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-[#26342b] leading-tight">{investor?.name}</p>
                <p className="text-[11px] text-gray-400">{investor?.email}</p>
                {investor?.verificationTier && (
                  <div className="mt-0.5">
                    <VerificationBadge tier={investor.verificationTier} status={investor.verificationStatus} size="sm" />
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                logout();
                navigate("/invest/login");
              }}
              className="p-2 text-gray-400 hover:text-red-500 transition"
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex pt-16">
        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-16 inset-y-0 left-0 z-30 w-64 bg-white border-r transform transition-transform lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } h-[calc(100vh-4rem)] overflow-y-auto`}
        >
          <nav className="p-4 space-y-4">
            {tabGroups.map((group) => (
              <div key={group.group}>
                <p className="px-4 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">
                  {group.group}
                </p>
                <div className="space-y-1">
                  {group.items.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => handleSetTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                        activeTab === tab.id
                          ? "bg-[#26342b] text-white shadow-md"
                          : "text-gray-600 hover:bg-[#f7f4ee] hover:text-[#26342b]"
                      }`}
                    >
                      <tab.icon className="w-5 h-5" />
                      {tab.label}
                      {tab.id === "notifications" && unread > 0 && (
                        <span
                          className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            activeTab === tab.id ? "bg-white/20 text-white" : "bg-[#c47a45] text-white"
                          }`}
                        >
                          {unread}
                        </span>
                      )}
                      {tab.id === "messages" && msgUnread > 0 && (
                        <span
                          className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            activeTab === tab.id ? "bg-white/20 text-white" : "bg-[#c47a45] text-white"
                          }`}
                        >
                          {msgUnread}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="p-4 mt-4">
            <div className="bg-[#26342b] rounded-2xl p-5 text-white">
              <p className="text-xs text-gray-300 uppercase tracking-wider">Need a home?</p>
              <p className="text-sm font-semibold mt-1.5 leading-relaxed">
                Browse our premium tiny homes from $20,000 — outright or with financing.
              </p>
              <Link
                to="/#catalog"
                className="inline-block mt-3 text-xs font-bold text-[#c47a45] hover:text-white transition"
              >
                View Catalog →
              </Link>
            </div>
          </div>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-20 lg:hidden top-16"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            <div className="mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#26342b] font-serif">
                {activeTab === "overview"
                  ? `Welcome back, ${investor?.name?.split(" ")[0]}`
                  : currentTab.label}
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                {activeTab === "overview"
                  ? "Here's how your home plans are performing."
                  : `Manage your ${currentTab.label.toLowerCase()} from here.`}
              </p>
            </div>

            {dashboardQuery.isLoading && activeTab === "overview" ? (
              <div className="flex items-center justify-center py-24">
                <div className="w-10 h-10 border-4 border-[#26342b] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <>
                {activeTab === "verification" && <VerificationTab />}
                {activeTab === "documents" && <DocumentsTab />}
                {activeTab === "overview" && (
                  <OverviewTab dashboard={dashboardQuery.data} setTab={handleSetTab} />
                )}
                {activeTab === "purchases" && investor && (
                  <PurchasesTab investorEmail={investor.email} setTab={handleSetTab} />
                )}
                {activeTab === "portfolio" && (
                  <PortfolioTab
                    portfolio={dashboardQuery.data?.portfolio ?? []}
                    setTab={handleSetTab}
                    onChanged={refetchAll}
                  />
                )}
                {activeTab === "invest" && (
                  <InvestTab
                    walletBalance={dashboardQuery.data?.stats?.walletBalance ?? 0}
                    onInvested={refetchAll}
                    setTab={handleSetTab}
                  />
                )}
                {activeTab === "profits" && <ProfitsTab />}
                {activeTab === "calculator" && <CalculatorTab setTab={handleSetTab} />}
                {activeTab === "liquidations" && <LiquidationsTab />}
                {activeTab === "mortgages" && (
                  <MortgagesTab
                    walletBalance={dashboardQuery.data?.stats?.walletBalance ?? 0}
                    onChanged={refetchAll}
                  />
                )}
                {activeTab === "appointments" && <AppointmentsTab />}
                {activeTab === "messages" && <MessagesTab />}
                {activeTab === "testimonials" && <TestimonialsTab />}
                {activeTab === "deposit" && (
                  <DepositTab
                    onDeposited={refetchAll}
                    stats={dashboardQuery.data?.stats}
                    setTab={handleSetTab}
                  />
                )}
                {activeTab === "withdraw" && (
                  <WithdrawTab
                    walletBalance={dashboardQuery.data?.stats?.walletBalance ?? 0}
                    kycStatus={investor?.kycStatus ?? "unverified"}
                    onWithdrawn={refetchAll}
                  />
                )}
                {activeTab === "transactions" && <TransactionsTab />}
                {activeTab === "referrals" && <ReferralsTab />}
                {activeTab === "notifications" && <NotificationsTab onChanged={refetchAll} />}
                {activeTab === "settings" && <SettingsTab investor={investor} />}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
