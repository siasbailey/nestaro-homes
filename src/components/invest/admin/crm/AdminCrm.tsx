import { useState } from "react";
import {
  Users, UserPlus, Activity, AlarmClock, CheckCircle2, XCircle, Percent, Timer,
  Building2, TrendingUp, Landmark, KanbanSquare, ListFilter, LayoutDashboard, Settings2,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { trpc } from "@/providers/trpc";
import CrmLeads from "./CrmLeads";
import CrmPipeline from "./CrmPipeline";
import CrmFollowUps from "./CrmFollowUps";
import CrmStages from "./CrmStages";

type View = "dashboard" | "leads" | "pipeline" | "followups" | "stages";

const NAVY = "#26342b";
const COPPER = "#c47a45";
const PIE_COLORS = [NAVY, COPPER, "#3d5045", "#a6632f", "#64748b", "#0ea5e9", "#16a34a", "#dc2626"];

function Card({ icon: Icon, label, value, sub, accent }: { icon: typeof Users; label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 border transition hover:shadow-md ${accent ? "bg-gradient-to-br from-[#c47a45] to-[#a6632f] border-transparent text-white" : "bg-white border-gray-200"}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-medium ${accent ? "text-white/80" : "text-gray-500"}`}>{label}</p>
          <p className={`text-xl font-bold font-serif mt-1 ${accent ? "text-white" : "text-[#26342b]"}`}>{value}</p>
          {sub && <p className={`text-[11px] mt-1 ${accent ? "text-white/70" : "text-gray-400"}`}>{sub}</p>}
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${accent ? "bg-white/20" : "bg-[#26342b]/5"}`}>
          <Icon className={`w-4 h-4 ${accent ? "text-white" : "text-[#26342b]"}`} />
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 p-5 ${className ?? ""}`}>
      <h4 className="font-bold text-[#26342b] text-sm mb-4">{title}</h4>
      {children}
    </div>
  );
}

function CrmDashboard() {
  const analyticsQuery = trpc.crm.analytics.useQuery(undefined, { retry: false, refetchInterval: 60_000 });
  const data = analyticsQuery.data;

  if (analyticsQuery.isLoading) {
    return <div className="py-10 text-center text-gray-400 text-sm">Loading CRM analytics…</div>;
  }
  if (!data) {
    return <div className="py-10 text-center text-gray-400 text-sm">Analytics unavailable.</div>;
  }

  const { cards, charts } = data;
  const funnelMax = Math.max(1, ...charts.funnel.map((f) => f.count));

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        <Card icon={Users} label="Total Leads" value={String(cards.total)} accent />
        <Card icon={UserPlus} label="New Today" value={String(cards.newToday)} />
        <Card icon={Activity} label="Active Leads" value={String(cards.active)} />
        <Card icon={AlarmClock} label="Follow-ups Due" value={String(cards.followUpsDue)} sub="due today or overdue" />
        <Card icon={CheckCircle2} label="Closed Deals" value={String(cards.closed)} />
        <Card icon={XCircle} label="Lost Deals" value={String(cards.lost)} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card icon={Percent} label="Conversion Rate" value={`${cards.conversionRate}%`} sub="closed ÷ total" />
        <Card
          icon={Timer}
          label="Avg Response Time"
          value={cards.avgResponseHours == null ? "—" : cards.avgResponseHours < 24 ? `${cards.avgResponseHours}h` : `${Math.round((cards.avgResponseHours / 24) * 10) / 10}d`}
          sub="first contact after capture"
        />
        <Card icon={Building2} label="Top Property" value={cards.mostRequestedProperty ?? "—"} sub="most requested" />
        <Card icon={TrendingUp} label="Top Plan" value={cards.mostPopularInvestmentPlan ?? "—"} sub="most popular plan" />
        <Card icon={Landmark} label="Top Mortgage" value={cards.mostPopularMortgagePlan ?? "—"} sub="most popular plan" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Leads by Month">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.leadsByMonth} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#888" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#888" }} />
                <Tooltip />
                <Bar dataKey="count" fill={NAVY} radius={[4, 4, 0, 0]} name="Leads" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Lead Sources">
          <div className="h-56">
            {charts.leadsBySource.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-16">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={charts.leadsBySource} dataKey="count" nameKey="source" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {charts.leadsBySource.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Conversion Funnel">
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {charts.funnel.map((f) => (
              <div key={f.key} className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500 w-36 truncate shrink-0" title={f.label}>{f.label}</span>
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(f.count / funnelMax) * 100}%`, backgroundColor: f.color }}
                  />
                </div>
                <span className="text-[11px] font-bold text-[#26342b] w-8 text-right">{f.count}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Sales Performance (assigned → closed)">
          <div className="h-56">
            {charts.salesPerformance.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-16">Assign leads to your team to see performance.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.salesPerformance} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#888" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#888" }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="assigned" fill={NAVY} radius={[4, 4, 0, 0]} name="Assigned" />
                  <Bar dataKey="closed" fill={COPPER} radius={[4, 4, 0, 0]} name="Closed" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Property Interest Distribution" className="lg:col-span-2">
          <div className="h-56">
            {charts.propertyInterest.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-16">No property interest recorded yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.propertyInterest} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#888" }} />
                  <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11, fill: "#555" }} />
                  <Tooltip />
                  <Bar dataKey="count" fill={COPPER} radius={[0, 4, 4, 0]} name="Leads" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

export default function AdminCrm() {
  const [view, setView] = useState<View>("dashboard");
  const meQuery = trpc.admin.adminMe.useQuery(undefined, { retry: false });
  const isPrimary = meQuery.data?.role === "primary";

  const views: { id: View; label: string; icon: typeof LayoutDashboard; primaryOnly?: boolean }[] = [
    { id: "dashboard", label: "CRM Dashboard", icon: LayoutDashboard },
    { id: "leads", label: "All Leads", icon: ListFilter },
    { id: "pipeline", label: "Pipeline", icon: KanbanSquare },
    { id: "followups", label: "Follow-ups", icon: AlarmClock },
    { id: "stages", label: "Stage Settings", icon: Settings2, primaryOnly: true },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {views
          .filter((v) => !v.primaryOnly || isPrimary)
          .map((v) => {
            const Icon = v.icon;
            return (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full border transition ${
                  view === v.id
                    ? "bg-[#26342b] text-white border-[#26342b]"
                    : "bg-white text-[#26342b] border-gray-200 hover:border-[#c47a45]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {v.label}
              </button>
            );
          })}
      </div>

      {view === "dashboard" && <CrmDashboard />}
      {view === "leads" && <CrmLeads />}
      {view === "pipeline" && <CrmPipeline />}
      {view === "followups" && <CrmFollowUps />}
      {view === "stages" && isPrimary && <CrmStages />}
    </div>
  );
}
