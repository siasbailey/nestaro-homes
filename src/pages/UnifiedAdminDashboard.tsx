import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  ArrowDownCircle,
  ArrowUpCircle,
  Coins,
  Wallet,
  Gift,
  Layers,
  FileBarChart2,
  Bell,
  ShieldCheck,
  Package,
  LogOut,
  Menu,
  X,
  Home,
  CircleDollarSign,
  Landmark,
  Banknote,
  UserCog,
  UserCircle,
  MessageSquareOff,
  Megaphone,
  FolderOpen,
  UsersRound,
  CalendarDays,
  MessageSquare,
  Star,
  Activity,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminOverview from "@/components/invest/admin/AdminOverview";
import AdminInvestments from "@/components/invest/admin/AdminInvestments";
import AdminLiquidations from "@/components/invest/admin/AdminLiquidations";
import AdminMortgagePlans from "@/components/invest/admin/AdminMortgagePlans";
import AdminMortgages from "@/components/invest/admin/AdminMortgages";
import AdminAdmins from "@/components/invest/admin/AdminAdmins";
import AdminProfileSettings from "@/components/invest/admin/AdminProfileSettings";
import AdminDeletionFeedback from "@/components/invest/admin/AdminDeletionFeedback";
import AdminInvestors from "@/components/invest/admin/AdminInvestors";
import { AdminDeposits, AdminWithdrawals } from "@/components/invest/admin/AdminFinance";
import { AdminProfits, AdminWallets } from "@/components/invest/admin/AdminProfitsWallets";
import { AdminReferrals } from "@/components/invest/admin/AdminOperations";
import AdminPlansProjects from "@/components/invest/admin/AdminPlansProjects";
import AdminReportsPro from "@/components/invest/admin/AdminReportsPro";
import { AdminNotificationsPanel, AdminAudit } from "@/components/invest/admin/AdminSystem";
import AdminAnnouncements from "@/components/admin/AdminAnnouncements";
import AdminVerification from "@/components/invest/admin/AdminVerification";
import AdminDocuments from "@/components/invest/admin/AdminDocuments";
import AdminCrm from "@/components/invest/admin/crm/AdminCrm";
import AdminAppointments from "@/components/invest/admin/AdminAppointments";
import MyNotifications from "@/components/invest/admin/crm/MyNotifications";
import AdminMessages from "@/components/invest/admin/AdminMessages";
import AdminActivityTimeline from "@/components/invest/admin/AdminActivityTimeline";
import AdminTestimonials from "@/components/invest/admin/AdminTestimonials";
import AdminBroadcasts from "@/components/invest/admin/AdminBroadcasts";
import AdminPendingActions from "@/components/invest/admin/AdminPendingActions";

type SectionId =
  | "property"
  | "announcements"
  | "crm"
  | "appointments"
  | "messages"
  | "activity"
  | "testimonials"
  | "broadcasts"
  | "overview"
  | "investments"
  | "liquidations"
  | "mortgagePlans"
  | "mortgages"
  | "investors"
  | "verification"
  | "documents"
  | "deposits"
  | "withdrawals"
  | "profits"
  | "wallets"
  | "referrals"
  | "plans"
  | "reports"
  | "notifications"
  | "audit"
  | "administrators"
  | "feedback"
  | "profile";

const investTabs: { id: SectionId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "investments", label: "Home Plans", icon: TrendingUp },
  { id: "liquidations", label: "Early Withdrawals", icon: CircleDollarSign },
  { id: "mortgagePlans", label: "Financing Plans", icon: Landmark },
  { id: "mortgages", label: "Financing", icon: Banknote },
  { id: "investors", label: "Customers", icon: Users },
  { id: "verification", label: "Customer Verification", icon: ShieldCheck },
  { id: "documents", label: "Document Management", icon: FolderOpen },
  { id: "testimonials", label: "Testimonials", icon: Star },
  { id: "broadcasts", label: "Broadcasts & Email", icon: Megaphone },
  { id: "activity", label: "Activity Timeline", icon: Activity },
  { id: "deposits", label: "Deposits", icon: ArrowDownCircle },
  { id: "withdrawals", label: "Withdrawals", icon: ArrowUpCircle },
  { id: "profits", label: "Home Credits", icon: Coins },
  { id: "wallets", label: "Wallets", icon: Wallet },
  { id: "referrals", label: "Referrals", icon: Gift },
  { id: "plans", label: "Plans & Projects", icon: Layers },
  { id: "reports", label: "Reports", icon: FileBarChart2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "audit", label: "Audit Log", icon: ShieldCheck },
];

export default function UnifiedAdminDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [section, setSection] = useState<SectionId>(
    (searchParams.get("section") as SectionId) || "property"
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Keep the visible section in sync with the URL — this is what makes the
  // browser/device Back button move between sections correctly.
  useEffect(() => {
    const s = (searchParams.get("section") as SectionId) || "property";
    if (s !== section) setSection(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!localStorage.getItem("flexhavens-admin")) {
      navigate("/admin", { replace: true });
    }
  }, [navigate]);

  const adminMeQuery = trpc.admin.adminMe.useQuery(undefined, {
    retry: false,
    refetchInterval: 30_000,
  });
  const me = adminMeQuery.data;
  const isPrimary = me?.role === "primary";
  const perms = new Set(me?.permissions ?? []);
  const canProperty = isPrimary || perms.has("orders") || perms.has("contact") || perms.has("catalog") || perms.has("content");
  const canAnnounce = isPrimary || perms.has("announcements");
  const canCrm = isPrimary || perms.has("crm");
  const canAppts = isPrimary || perms.has("appointments");
  const canMessages = isPrimary || perms.has("support");

  // Session expired or account suspended → back to login
  useEffect(() => {
    // Session expired / account suspended (401/403) → back to login.
    // Transient API failures (network/5xx) must NOT log the admin out.
    const errData = (adminMeQuery.error as any)?.data as { httpStatus?: number; code?: string } | undefined;
    if (
      adminMeQuery.isError &&
      (errData?.httpStatus === 401 ||
        errData?.httpStatus === 403 ||
        errData?.code === "UNAUTHORIZED" ||
        errData?.code === "FORBIDDEN")
    ) {
      localStorage.removeItem("flexhavens-admin");
      navigate("/admin", { replace: true });
    }
  }, [adminMeQuery.isError, adminMeQuery.error, navigate]);

  const firstAllowed: SectionId = canProperty
    ? "property"
    : canAnnounce
      ? "announcements"
      : canCrm
        ? "crm"
        : canAppts
          ? "appointments"
          : canMessages
            ? "messages"
            : "profile";

  // Keep the current section within the admin's permissions
  useEffect(() => {
    if (!me) return;
    const investIds = investTabs.map((t) => t.id);
    const allowed =
      section === "profile" ||
      (section === "property" && canProperty) ||
      (section === "announcements" && canAnnounce) ||
      (section === "crm" && canCrm) ||
      (section === "appointments" && canAppts) ||
      (section === "messages" && canMessages) ||
      (section === "notifications" && (canCrm || canAppts)) ||
      (isPrimary && (investIds.includes(section) || section === "administrators" || section === "feedback"));
    if (!allowed) handleSetSection(firstAllowed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, isPrimary]);

  const unreadQuery = trpc.investAdmin.adminUnreadCount.useQuery(undefined, {
    refetchInterval: 30000,
    retry: false,
    enabled: isPrimary,
  });
  const unread = unreadQuery.data?.count ?? 0;

  // Real pending admin work (deposits, withdrawals, approvals, …). The
  // badge stays up until each underlying record is actually handled.
  const pendingQuery = trpc.investAdmin.pendingActions.useQuery(undefined, {
    refetchInterval: 20_000,
    retry: false,
    enabled: isPrimary,
  });

  // Targeted notifications for secondary admins (CRM assignments, follow-ups)
  const myUnreadQuery = trpc.crm.myUnreadCount.useQuery(undefined, {
    refetchInterval: 30000,
    retry: false,
    enabled: !!me && !isPrimary && (canCrm || canAppts),
  });

  // Unread message-center conversations (badge on Messages nav item)
  const msgUnreadQuery = trpc.message.adminUnreadCount.useQuery(undefined, {
    refetchInterval: 20000,
    retry: false,
    enabled: !!me && canMessages,
  });
  const msgUnread = msgUnreadQuery.data?.count ?? 0;
  const bellBadge = isPrimary ? unread : (myUnreadQuery.data?.count ?? 0);
  const showBell = isPrimary || canCrm || canAppts;

  const handleSetSection = (id: SectionId) => {
    setSidebarOpen(false);
    if (id === section) return; // no duplicate history entries
    setSection(id);
    // Push a real history entry so Back returns to the previous section
    setSearchParams({ section: id });
  };

  // Deep-link from the pending-actions indicator: jumps to the target
  // section and (where the screen supports it) pre-selects its pending
  // filter via the ?filter= URL param.
  const navigateToPending = (id: string, filter?: string) => {
    setSidebarOpen(false);
    const sid = id as SectionId;
    setSection(sid);
    setSearchParams(filter ? { section: sid, filter } : { section: sid });
  };

  const logoutMutation = trpc.admin.logout.useMutation();
  const logout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        localStorage.removeItem("flexhavens-admin");
        navigate("/admin", { replace: true });
      },
    });
  };

  const accountTabs: { id: SectionId; label: string }[] = [
    { id: "administrators", label: "Administrators" },
    { id: "feedback", label: "Deletion Feedback" },
    { id: "profile", label: "My Profile" },
  ];
  const currentLabel =
    section === "property"
      ? "Property Orders"
      : section === "announcements"
        ? "Announcement Bar"
        : section === "crm"
          ? "CRM / Lead Management"
          : section === "appointments"
            ? "Appointments"
            : section === "messages"
              ? "Messages"
              : investTabs.find((t) => t.id === section)?.label ??
              accountTabs.find((t) => t.id === section)?.label ??
              "Overview";

  if (adminMeQuery.isLoading && !me) {
    return (
      <div className="min-h-screen bg-[#f7f4ee] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#26342b] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Auth check failed for a non-auth reason (network/5xx): show a retry state
  // instead of bouncing to login or rendering a permissions-degraded shell.
  if (adminMeQuery.isError && !me) {
    return (
      <div className="min-h-screen bg-[#f7f4ee] flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <h1 className="text-xl font-bold font-serif text-[#26342b] mb-2">Connection problem</h1>
          <p className="text-sm text-gray-500 mb-6">We couldn't verify your admin session. Check your connection and try again.</p>
          <button
            onClick={() => adminMeQuery.refetch()}
            className="w-full bg-[#26342b] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#3d5045] transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const navButton = (id: SectionId, label: string, Icon: typeof Package, badge?: number) => (
    <button
      key={id}
      onClick={() => handleSetSection(id)}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        section === id
          ? "bg-[#c47a45] text-white"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      {badge != null && badge > 0 && (
        <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-white/10">
        <Link to="/" className="flex items-center gap-2">
          <Home className="w-5 h-5 text-[#c47a45]" />
          <span className="font-serif text-lg font-bold text-white">Nestaro Homes</span>
        </Link>
        <p className="text-[11px] uppercase tracking-wider text-white/50 mt-1">Admin Console</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {(canProperty || canAnnounce) && (
          <div>
            <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">
              Section A
            </p>
            <div className="space-y-1">
              {canProperty && navButton("property", "Property Orders", Package)}
              {canAnnounce && navButton("announcements", "Announcement Bar", Megaphone)}
            </div>
          </div>
        )}
        {(canCrm || canAppts || canMessages) && (
          <div>
            <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">
              CRM & Sales
            </p>
            <div className="space-y-1">
              {canCrm && navButton("crm", "CRM / Leads", UsersRound)}
              {canAppts && navButton("appointments", "Appointments", CalendarDays)}
              {canMessages && navButton("messages", "Messages", MessageSquare, msgUnread)}
              {!isPrimary && navButton("notifications", "Notifications", Bell, bellBadge)}
            </div>
          </div>
        )}
        {isPrimary && (
          <div>
            <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">
              Section B — Investment Platform
            </p>
            <div className="space-y-1">
              {investTabs.map((t) =>
                navButton(t.id, t.label, t.icon, t.id === "notifications" ? unread : undefined)
              )}
            </div>
          </div>
        )}
        <div>
          <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">
            Account
          </p>
          <div className="space-y-1">
            {isPrimary && navButton("administrators", "Administrators", UserCog)}
            {isPrimary && navButton("feedback", "Deletion Feedback", MessageSquareOff)}
            {navButton("profile", "My Profile", UserCircle)}
          </div>
        </div>
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Log Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f7f4ee] flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 bg-[#26342b] fixed inset-y-0 left-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-[#26342b] z-50">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 text-white/70 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 sm:px-6 py-3.5 flex items-center gap-3">
          <button
            className="lg:hidden text-[#26342b]"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-xl font-bold text-[#26342b] truncate">
              {currentLabel}
            </h1>
            <p className="text-xs text-gray-500 hidden sm:block">
              {section === "property"
                ? "Manage property purchases, customers and listings"
                : section === "announcements"
                  ? "Manage the scrolling website announcement bar"
                  : "Investment platform administration"}
            </p>
          </div>

          {/* Signed-in admin chip */}
          {me && (
            <button
              onClick={() => handleSetSection("profile")}
              className="hidden md:flex items-center gap-2 mr-1 hover:bg-gray-100 rounded-full pl-1 pr-3 py-1 transition"
              title="My Profile"
            >
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden ${me.role === "primary" ? "bg-[#c47a45]" : "bg-[#26342b]"}`}>
                {me.avatar ? <img src={me.avatar} alt="" className="w-full h-full object-cover" /> : me.displayName.charAt(0).toUpperCase()}
              </span>
              <span className="text-left">
                <span className="block text-xs font-bold text-[#26342b] leading-tight">{me.displayName}</span>
                <span className="block text-[10px] text-gray-400 capitalize leading-tight">{me.role} admin</span>
              </span>
            </button>
          )}

          {/* Pending-actions indicator (primary admin) — badge reflects real
              unresolved records and stays until each is handled */}
          {isPrimary && (
            <AdminPendingActions
              data={pendingQuery.data}
              onNavigate={navigateToPending}
              onOpenNotifications={() => handleSetSection("notifications")}
            />
          )}

          {/* Notification bell (secondary admins: targeted notifications) */}
          {!isPrimary && showBell && (
          <button
            onClick={() => handleSetSection("notifications")}
            className="relative p-2 rounded-full hover:bg-gray-100 text-[#26342b] transition-colors"
            title="Admin notifications"
          >
            <Bell className="w-5 h-5" />
            {bellBadge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {bellBadge > 99 ? "99+" : bellBadge}
              </span>
            )}
          </button>
          )}

          <button
            onClick={logout}
            className="hidden sm:flex items-center gap-2 text-sm text-gray-600 hover:text-[#26342b] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          {section === "property" && <AdminDashboard embedded />}
          {section === "announcements" && canAnnounce && <AdminAnnouncements />}
          {section === "crm" && canCrm && <AdminCrm />}
          {section === "appointments" && canAppts && <AdminAppointments />}
          {section === "messages" && canMessages && <AdminMessages />}
          {section === "overview" && <AdminOverview />}
          {section === "investments" && <AdminInvestments />}
          {section === "liquidations" && <AdminLiquidations />}
          {section === "mortgagePlans" && <AdminMortgagePlans />}
          {section === "mortgages" && <AdminMortgages />}
          {section === "investors" && <AdminInvestors />}
          {section === "verification" && <AdminVerification />}
          {section === "documents" && <AdminDocuments />}
          {section === "testimonials" && <AdminTestimonials />}
          {section === "broadcasts" && <AdminBroadcasts />}
          {section === "activity" && <AdminActivityTimeline />}
          {section === "deposits" && <AdminDeposits />}
          {section === "withdrawals" && <AdminWithdrawals />}
          {section === "profits" && <AdminProfits />}
          {section === "wallets" && <AdminWallets />}
          {section === "referrals" && <AdminReferrals />}
          {section === "plans" && <AdminPlansProjects />}
          {section === "reports" && <AdminReportsPro />}
          {section === "notifications" && (isPrimary ? <AdminNotificationsPanel /> : <MyNotifications />)}
          {section === "audit" && <AdminAudit />}
          {section === "administrators" && isPrimary && <AdminAdmins />}
          {section === "feedback" && isPrimary && <AdminDeletionFeedback />}
          {section === "profile" && <AdminProfileSettings />}
        </main>
      </div>
    </div>
  );
}
