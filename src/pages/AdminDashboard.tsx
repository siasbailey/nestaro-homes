import { Fragment, useEffect, useState } from "react";
import { formatCurrency, formatDate, formatDateTime } from "@/hooks/use-investor";
import { Link, useNavigate } from "react-router";
import {
  LogOut, Search, Package, DollarSign, Clock, Building2, CheckCircle,
  ChevronDown, ChevronUp, RefreshCw, MessageSquare,
  Home, Shield, Trash2, Upload, FileText, Download, Loader2, Pencil, Images, Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { PURCHASE_STAGES } from "@contracts/purchase-stages";
import AdminPropertyMedia from "@/components/admin/AdminPropertyMedia";
import AdminTeam from "@/components/admin/AdminTeam";

const statusLabels: Record<string, string> = Object.fromEntries([
  ...PURCHASE_STAGES.map((s) => [s.key, s.label] as const),
  ["cancelled", "Cancelled"] as const,
]);

const statusColors: Record<string, string> = {
  purchase_request: "bg-blue-100 text-blue-800",
  payment_verification: "bg-teal-100 text-teal-800",
  purchase_agreement: "bg-indigo-100 text-indigo-800",
  legal_documentation: "bg-purple-100 text-purple-800",
  property_allocation: "bg-amber-100 text-amber-800",
  title_documentation: "bg-pink-100 text-pink-800",
  final_inspection: "bg-cyan-100 text-cyan-800",
  handover_preparation: "bg-orange-100 text-orange-800",
  handed_over: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function AdminDashboard({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [updateNotes, setUpdateNotes] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<"orders" | "contacts" | "properties" | "media" | "team">("orders");
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [priceDraft, setPriceDraft] = useState("");

  useEffect(() => {
    if (embedded) return; // unified dashboard handles auth
    const isAuth = localStorage.getItem("flexhavens-admin");
    if (!isAuth) {
      navigate("/admin", { replace: true });
    }
  }, [navigate, embedded]);

  // RBAC: secondary admins only see the tabs they have permission for
  const { data: adminMe } = trpc.admin.adminMe.useQuery(undefined, { retry: false });
  const canOrders = !adminMe || adminMe.role === "primary" || adminMe.permissions.includes("orders");
  const canContacts = !adminMe || adminMe.role === "primary" || adminMe.permissions.includes("contact");
  const canCatalog = !adminMe || adminMe.role === "primary" || adminMe.permissions.includes("catalog");
  const canContent = !adminMe || adminMe.role === "primary" || adminMe.permissions.includes("content");

  useEffect(() => {
    if (!adminMe) return;
    const allowed: Record<string, boolean> = { orders: canOrders, contacts: canContacts, properties: canCatalog, media: canCatalog, team: canContent };
    if (!allowed[activeTab]) {
      if (canOrders) setActiveTab("orders");
      else if (canContacts) setActiveTab("contacts");
      else if (canCatalog) setActiveTab("properties");
      else if (canContent) setActiveTab("team");
    }
  }, [adminMe, activeTab, canOrders, canContacts, canCatalog, canContent]);

  const { data: stats, refetch: refetchStats } = trpc.admin.stats.useQuery(undefined, {
    enabled: canOrders,
  });
  const { data: orders, refetch: refetchOrders } = trpc.admin.orders.useQuery(
    { search: search || undefined, status: statusFilter !== "all" ? statusFilter : undefined },
    { enabled: canOrders }
  );
  const { data: contacts, refetch: refetchContacts } = trpc.admin.contacts.useQuery(undefined, {
    enabled: activeTab === "contacts" && canContacts,
  });
  const { data: properties, refetch: refetchProperties } = trpc.admin.properties.useQuery(undefined, {
    enabled: (activeTab === "properties" || activeTab === "media") && canCatalog,
  });

  const updatePrice = trpc.admin.updatePropertyPrice.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Price updated — ${data.product.name} is now ${formatCurrency(Number(data.product.price))}. Existing purchases keep their agreed price.`,
      );
      setEditingPriceId(null);
      setPriceDraft("");
      refetchProperties();
    },
    onError: (err) => toast.error(err.message),
  });

  const savePrice = (p: any) => {
    const value = Number(priceDraft);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid price greater than zero.");
      return;
    }
    const confirmed = window.confirm(
      `Change the price of ${p.name}?\n\nCurrent price: ${formatCurrency(Number(p.price))}\nNew price: ${formatCurrency(value)}\n\nThe new price becomes the current selling price everywhere. Existing purchases, contracts and receipts keep their original agreed price.`,
    );
    if (!confirmed) return;
    updatePrice.mutate({ productId: p.id, price: value });
  };

  const updateStatus = trpc.admin.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Purchase stage updated — buyer notified by email.");
      refetchOrders();
      refetchStats();
      setUpdateNotes((prev) => ({ ...prev, [expandedOrder!]: "" }));
    },
    onError: (err) => toast.error(err.message),
  });

  const updatePayment = trpc.admin.updatePayment.useMutation({
    onSuccess: () => {
      toast.success("Payment status updated!");
      refetchOrders();
    },
    onError: (err) => toast.error(err.message),
  });

  const addNote = trpc.admin.addNote.useMutation({
    onSuccess: () => {
      toast.success("Note added!");
      refetchOrders();
      setUpdateNotes((prev) => ({ ...prev, [expandedOrder!]: "" }));
    },
    onError: (err) => toast.error(err.message),
  });

  // SAFE: Only create mutation if route exists
  const deleteOrder = (trpc.admin as any).deleteOrder?.useMutation({
    onSuccess: () => {
      toast.success("Order deleted!");
      refetchOrders();
      refetchStats();
      setExpandedOrder(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteHistory = (trpc.admin as any).deleteHistory?.useMutation({
    onSuccess: () => {
      toast.success("History cleared!");
      refetchOrders();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Supporting documents for the expanded order
  const { data: expandedDetail, refetch: refetchDetail } = trpc.admin.orderDetail.useQuery(
    { orderId: expandedOrder as number },
    { enabled: expandedOrder != null && canOrders }
  );
  const orderDocuments = expandedDetail?.documents ?? [];

  const uploadDocument = trpc.admin.uploadOrderDocument.useMutation({
    onSuccess: () => {
      toast.success("Document uploaded.");
      refetchDetail();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteDocument = trpc.admin.deleteOrderDocument.useMutation({
    onSuccess: () => {
      toast.success("Document removed.");
      refetchDetail();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleDocumentUpload = (orderId: number, file: File | null) => {
    if (!file) return;
    const okTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!okTypes.includes(file.type)) {
      toast.error("Only PDF or image files (JPG, PNG, WebP) are allowed.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File is too large — maximum 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      uploadDocument.mutate({ orderId, name: file.name, dataUrl: String(reader.result) });
    };
    reader.onerror = () => toast.error("Could not read the file.");
    reader.readAsDataURL(file);
  };

  const markContactRead = trpc.contact.markRead.useMutation({
    onSuccess: () => {
      refetchContacts();
      refetchStats();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleLogout = () => {
    localStorage.removeItem("flexhavens-admin");
    navigate("/admin");
  };

  const handleStatusUpdate = (orderId: number, status: string) => {
    const note = updateNotes[orderId] || "";

    updateStatus.mutate({
      orderId,
      status: status as any,
      note: note.trim() || undefined,
    });
  };

  const handleAddNote = (orderId: number) => {
    const note = updateNotes[orderId] || "";
    if (!note.trim()) {
      toast.error("Please enter a note first");
      return;
    }
    addNote.mutate({ orderId, note });
  };

  const handleDeleteOrder = (orderId: number) => {
    if (!deleteOrder) {
      toast.error("Delete feature not available on backend");
      return;
    }
    if (!confirm("Delete this order permanently?")) return;
    deleteOrder.mutate({ orderId });
  };

  const handleDeleteHistory = (orderId: number) => {
    if (!deleteHistory) {
      toast.error("Clear history feature not available on backend");
      return;
    }
    if (!confirm("Clear all tracking history for this order?")) return;
    deleteHistory.mutate({ orderId });
  };

  // Safe property accessor
  const safeGet = (obj: any, ...paths: string[]) => {
    for (const path of paths) {
      const val = path.split('.').reduce((o, k) => o?.[k], obj);
      if (val !== undefined && val !== null) return val;
    }
    return undefined;
  };

  return (
    <div className={embedded ? "" : "min-h-screen bg-gray-50"}>
      {/* Header */}
      {!embedded && (
      <header className="bg-[#26342b] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center gap-3 h-16">
            <div className="flex items-center gap-3 min-w-0">
              <Shield className="w-6 h-6 text-[#c47a45] shrink-0" />
              <h1 className="text-xl font-bold truncate">Nestaro Homes Admin</h1>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <Link to="/" className="text-sm text-gray-300 hover:text-white transition">
                <Home className="w-4 h-4 inline mr-1" />
                View Site
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-300 hover:text-white transition flex items-center gap-1"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>
      )}

      <main className={embedded ? "" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"}>
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Purchases", value: stats?.totalOrders ?? 0, icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Revenue", value: formatCurrency(stats?.totalRevenue ?? 0), icon: DollarSign, color: "text-green-600", bg: "bg-green-50" },
            { label: "Pending", value: stats?.pendingOrders ?? 0, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
            { label: "In Progress", value: stats?.inTransitOrders ?? 0, icon: Building2, color: "text-orange-600", bg: "bg-orange-50" },
          ].map((stat) => (
            <Card key={stat.label} className="p-3 sm:p-4 min-w-0">
              {/* On phones the icon stacks above the text so long revenue
                  figures get the full card width instead of wrapping mid-number */}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500 break-words">{stat.label}</p>
                  <p className="text-base sm:text-2xl font-bold text-[#26342b] break-words [overflow-wrap:anywhere]">{stat.value}</p>
                </div>
                <div className={`w-9 h-9 sm:w-10 sm:h-10 ${stat.bg} rounded-lg flex items-center justify-center shrink-0`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 sm:gap-4 mb-6">
          {canOrders && (
            <button
              onClick={() => setActiveTab("orders")}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === "orders" ? "bg-[#26342b] text-white" : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Package className="w-4 h-4 inline mr-2" />
              Orders
            </button>
          )}
          {canContacts && (
            <button
              onClick={() => setActiveTab("contacts")}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === "contacts" ? "bg-[#26342b] text-white" : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              <MessageSquare className="w-4 h-4 inline mr-2" />
              Contact Messages
              {stats && stats.unreadContacts > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full inline-flex items-center justify-center">
                  {stats.unreadContacts}
                </span>
              )}
            </button>
          )}
          {canCatalog && (
            <button
              onClick={() => setActiveTab("properties")}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === "properties" ? "bg-[#26342b] text-white" : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Building2 className="w-4 h-4 inline mr-2" />
              Property Prices
            </button>
          )}
          {canCatalog && (
            <button
              onClick={() => setActiveTab("media")}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === "media" ? "bg-[#26342b] text-white" : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Images className="w-4 h-4 inline mr-2" />
              Property Media
            </button>
          )}
          {canContent && (
            <button
              onClick={() => setActiveTab("team")}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === "team" ? "bg-[#26342b] text-white" : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Team
            </button>
          )}
        </div>

        {activeTab === "orders" && canOrders && (
          <>
            {/* Filters */}
            <Card className="p-4 mb-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by order number or customer name..."
                      className="pl-10"
                    />
                  </div>
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#26342b]/20"
                >
                  <option value="all">All Statuses</option>
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <Button variant="outline" onClick={() => { refetchOrders(); refetchStats(); }}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </Card>

            {/* Orders Table */}
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Order #</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Customer</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Amount</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Payment</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Date</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders?.map((order: any) => {
                      const orderData = order?.order || order || {};
                      const customer = order?.customer;
                      const items = order?.items || [];
                      const history = order?.history || [];
                      const isExpanded = expandedOrder === order?.id;
                      
                      return (
                        <Fragment key={order?.id ?? Math.random()}>
                          <tr className="hover:bg-gray-50 transition">
                            <td className="px-4 py-3 font-mono text-sm text-[#26342b] [overflow-wrap:anywhere]">
                              {safeGet(orderData, "orderNumber") || "N/A"}
                            </td>
                            <td className="px-4 py-3">
                              {customer ? (
                                <div className="min-w-0">
                                  <p className="font-medium text-sm break-words">{customer.firstName} {customer.lastName}</p>
                                  <p className="text-xs text-gray-500 [overflow-wrap:anywhere]">{customer.email}</p>
                                </div>
                              ) : (
                                <span className="text-gray-400">Unknown</span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-semibold text-sm">
                              {formatCurrency(Number(safeGet(orderData, "totalAmount") || 0))}
                            </td>
                            <td className="px-4 py-3">
                              <Badge className={statusColors[safeGet(orderData, "orderStatus")] || "bg-gray-100"}>
                                {statusLabels[safeGet(orderData, "orderStatus")] || safeGet(orderData, "orderStatus") || "Unknown"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={safeGet(orderData, "paymentStatus") === "confirmed" ? "default" : "secondary"}>
                                {safeGet(orderData, "paymentStatus") || "pending"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {safeGet(orderData, "createdAt") ? formatDate(safeGet(orderData, "createdAt")) : "N/A"}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => setExpandedOrder(isExpanded ? null : order?.id)}
                                className="text-[#26342b] hover:text-[#3d5045] transition"
                              >
                                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                              </button>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr>
                              <td colSpan={7} className="px-4 py-4 bg-gray-50">
                                {/* Cap detail width on small screens so expanded order content
                                    never requires sideways reading inside the scrolling table;
                                    sticky keeps it in view while the table scrolls */}
                                <div className="space-y-4 max-w-[calc(100vw-5rem)] md:max-w-none sticky left-0">
                                  {/* Customer Details */}
                                  {customer && (
                                    <div className="grid md:grid-cols-2 gap-4">
                                      <div>
                                        <h4 className="font-semibold text-sm text-[#26342b] mb-2">Customer Details</h4>
                                        <div className="text-sm space-y-1">
                                          <p className="break-words"><span className="text-gray-500">Name:</span> {customer.firstName} {customer.middleName} {customer.lastName}</p>
                                          <p className="[overflow-wrap:anywhere]"><span className="text-gray-500">Email:</span> {customer.email}</p>
                                          <p className="break-words"><span className="text-gray-500">Phone:</span> {customer.phone}</p>
                                          <p className="break-words"><span className="text-gray-500">Address:</span> {customer.city}, {customer.state}, {customer.country} {customer.postalCode}</p>
                                        </div>
                                      </div>
                                      <div>
                                        <h4 className="font-semibold text-sm text-[#26342b] mb-2">Order Items</h4>
                                        {items.length > 0 ? items.map((item: any) => (
                                          <div key={item?.id ?? Math.random()} className="text-sm">
                                            <p>{item?.productName} x {item?.quantity} = {formatCurrency(Number(item?.totalPrice || 0))}</p>
                                          </div>
                                        )) : <p className="text-sm text-gray-400">No items</p>}
                                      </div>
                                    </div>
                                  )}

                                  {/* Status Update */}
                                  <div className="border-t pt-4">
                                    <h4 className="font-semibold text-sm text-[#26342b] mb-3">Update Purchase Stage <span className="font-normal text-gray-400">(buyer is emailed automatically)</span></h4>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                      {Object.entries(statusLabels).map(([key, label]) => (
                                        <Button
                                          key={key}
                                          type="button"
                                          size="sm"
                                          variant={safeGet(orderData, "orderStatus") === key ? "default" : "outline"}
                                          onClick={() => handleStatusUpdate(order?.id, key)}
                                          disabled={updateStatus.isPending}
                                          className="text-xs"
                                        >
                                          {label}
                                        </Button>
                                      ))}
                                    </div>


                                    <div className="flex flex-col sm:flex-row gap-2">
                                      <Input
                                        value={updateNotes[order?.id] || ""}
                                        onChange={(e) => setUpdateNotes((prev) => ({ ...prev, [order?.id]: e.target.value }))}
                                        placeholder="Add a note (optional)..."
                                        className="flex-1 min-w-0"
                                      />
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => handleAddNote(order?.id)}
                                      >
                                        Add Note
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Payment Update */}
                                  <div className="border-t pt-4">
                                    <h4 className="font-semibold text-sm text-[#26342b] mb-2">Payment Status</h4>
                                    <div className="flex gap-2">
                                      {["pending", "confirmed", "failed"].map((s) => (
                                        <Button
                                          key={s}
                                          type="button"
                                          size="sm"
                                          variant={safeGet(orderData, "paymentStatus") === s ? "default" : "outline"}
                                          onClick={() => updatePayment.mutate({ orderId: order?.id, paymentStatus: s as any })}
                                        >
                                          {s.charAt(0).toUpperCase() + s.slice(1)}
                                        </Button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Admin Notes */}
                                  {safeGet(orderData, "adminNotes") && (
                                    <div className="border-t pt-4">
                                      <h4 className="font-semibold text-sm text-[#26342b] mb-2">Admin Notes</h4>
                                      <pre className="text-xs text-gray-600 bg-white p-3 rounded border whitespace-pre-wrap">
                                        {safeGet(orderData, "adminNotes")}
                                      </pre>
                                    </div>
                                  )}

                                  {/* Tracking History */}
                                  {history.length > 0 && (
                                    <div className="border-t pt-4">
                                      <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-semibold text-sm text-[#26342b]">Purchase Progress History ({history.length})</h4>
                                        {deleteHistory && (
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="text-red-600 border-red-300 hover:bg-red-50"
                                            onClick={() => handleDeleteHistory(order?.id)}
                                            disabled={deleteHistory.isPending}
                                          >
                                            <Trash2 className="w-3 h-3 mr-1" />
                                            Clear History
                                          </Button>
                                        )}
                                      </div>
                                      <div className="space-y-2">
                                        {history.map((h: any, i: number) => (
                                          <div key={i} className="text-sm flex items-start gap-2">
                                            <div className="w-2 h-2 bg-[#c47a45] rounded-full mt-1.5 flex-shrink-0" />
                                            <div>
                                              <span className="font-medium">{statusLabels[h?.status] || h?.status}</span>
                                              {h?.note && <span className="text-gray-500 ml-2">— {h.note}</span>}
                                              <span className="text-gray-400 text-xs ml-2">
                                                {h?.createdAt ? formatDateTime(h.createdAt) : ""}
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Purchase Documents */}
                                  <div className="border-t pt-4">
                                    <h4 className="font-semibold text-sm text-[#26342b] mb-2">
                                      Purchase Documents ({orderDocuments.length})
                                    </h4>
                                    <p className="text-xs text-gray-500 mb-3">
                                      Upload supporting documents for this purchase — purchase agreement, title documents, inspection reports, receipts (PDF or image, max 2MB). The buyer can download them from their tracking page and dashboard.
                                    </p>
                                    <div className="flex items-center gap-2 mb-3">
                                      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#26342b] text-white text-sm cursor-pointer hover:bg-[#3d5045] transition">
                                        {uploadDocument.isPending ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <Upload className="w-4 h-4" />
                                        )}
                                        Upload Document
                                        <input
                                          type="file"
                                          accept=".pdf,image/jpeg,image/png,image/webp"
                                          className="hidden"
                                          disabled={uploadDocument.isPending}
                                          onChange={(e) => {
                                            handleDocumentUpload(order?.id, e.target.files?.[0] ?? null);
                                            e.target.value = "";
                                          }}
                                        />
                                      </label>
                                    </div>
                                    {orderDocuments.length > 0 ? (
                                      <div className="space-y-2">
                                        {orderDocuments.map((d: any) => (
                                          <div key={d.id} className="flex items-center justify-between bg-white border rounded-lg px-3 py-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                              <FileText className="w-4 h-4 text-[#c47a45] flex-shrink-0" />
                                              <span className="text-sm truncate">{d.name}</span>
                                              <span className="text-xs text-gray-400 flex-shrink-0">
                                                {d.uploadedAt ? formatDateTime(d.uploadedAt) : ""}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                              <a
                                                href={d.dataUrl}
                                                download={d.name}
                                                className="p-1.5 text-[#26342b] hover:bg-gray-100 rounded"
                                                title="Download"
                                              >
                                                <Download className="w-4 h-4" />
                                              </a>
                                              <button
                                                type="button"
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                                title="Delete"
                                                disabled={deleteDocument.isPending}
                                                onClick={() => {
                                                  if (window.confirm(`Delete "${d.name}"?`)) {
                                                    deleteDocument.mutate({ documentId: d.id });
                                                  }
                                                }}
                                              >
                                                <Trash2 className="w-4 h-4" />
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-400">No documents uploaded yet.</p>
                                    )}
                                  </div>

                                  {/* Delete Order */}
                                  {deleteOrder && (
                                    <div className="border-t pt-4 flex justify-end">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleDeleteOrder(order?.id)}
                                        disabled={deleteOrder.isPending}
                                      >
                                        <Trash2 className="w-4 h-4 mr-1" />
                                        Delete Order
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
                {(!orders || orders.length === 0) && (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No purchases found</p>
                  </div>
                )}
              </div>
            </Card>
          </>
        )}

        {activeTab === "contacts" && canContacts && (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Name</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Email</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Message</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Date</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {contacts?.map((contact: any) => (
                    <tr key={contact?.id ?? Math.random()} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-medium text-sm">{contact?.firstName} {contact?.lastName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 [overflow-wrap:anywhere]">{contact?.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 min-w-[140px] max-w-xs whitespace-normal break-words [overflow-wrap:anywhere]">{contact?.message}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {contact?.createdAt ? formatDate(contact.createdAt) : "N/A"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={contact?.isRead === "yes" ? "default" : "secondary"}>
                          {contact?.isRead === "yes" ? "Read" : "New"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {contact?.isRead === "no" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => markContactRead.mutate({ id: contact?.id })}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Mark Read
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!contacts || contacts.length === 0) && (
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No contact submissions</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {activeTab === "properties" && canCatalog && (
          <Card className="overflow-hidden">
            <div className="px-4 py-3 bg-[#f7f4ee] border-b border-[#c47a45]/15">
              <p className="text-xs text-gray-600">
                <span className="font-semibold text-[#26342b]">Property Price Management.</span> The
                price saved here becomes the current selling price across the catalog, property
                pages, cart, checkout and mortgage calculators. Existing purchases, contracts,
                receipts and mortgages always keep their original agreed price.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Property</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Category</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Current Price</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {properties?.map((p: any) => {
                    const img = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null;
                    const editing = editingPriceId === p.id;
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {img ? (
                              <img src={img} alt={p.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-[#26342b]/5 flex items-center justify-center shrink-0">
                                <Building2 className="w-5 h-5 text-[#26342b]" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-medium text-sm text-[#26342b] truncate max-w-[220px]">{p.name}</p>
                              <p className="text-xs text-gray-400">{p.size} · {p.bedrooms} bed</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="uppercase">{p.category}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          {editing ? (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 text-sm">$</span>
                              <Input
                                type="number"
                                min="1"
                                step="0.01"
                                value={priceDraft}
                                onChange={(e) => setPriceDraft(e.target.value)}
                                className="w-40 h-9"
                                autoFocus
                              />
                            </div>
                          ) : (
                            <span className="font-bold text-sm text-[#26342b]">
                              {formatCurrency(Number(p.price))}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={p.isActive === "yes" ? "default" : "secondary"}>
                            {p.isActive === "yes" ? "Active" : "Hidden"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {editing ? (
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => savePrice(p)}
                                disabled={updatePrice.isPending || !priceDraft}
                                className="bg-[#26342b] hover:bg-[#3d5045]"
                              >
                                {updatePrice.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                )}
                                Save
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingPriceId(null);
                                  setPriceDraft("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingPriceId(p.id);
                                setPriceDraft(String(Number(p.price)));
                              }}
                            >
                              <Pencil className="w-4 h-4 mr-1" />
                              Edit Price
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(!properties || properties.length === 0) && (
                <div className="text-center py-12">
                  <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No properties found</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {activeTab === "media" && canCatalog && <AdminPropertyMedia />}

        {activeTab === "team" && canContent && <AdminTeam />}
      </main>
    </div>
  );
}