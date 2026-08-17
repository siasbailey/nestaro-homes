import { useState } from "react";
import {
  Users, Pencil, Trash2, Plus, Loader2, ChevronUp, ChevronDown, Camera, RefreshCw, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";

type Member = {
  id: number;
  name: string;
  role: string;
  bio: string | null;
  photo: string | null;
  sortOrder: number;
  isActive: "yes" | "no";
};

const EMPTY_FORM = {
  name: "",
  role: "",
  bio: "",
  photo: "",
  sortOrder: 0,
  isActive: "yes" as "yes" | "no",
};

export default function AdminTeam() {
  const { data: members, refetch } = trpc.admin.teamMembers.useQuery(undefined, { retry: false });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const save = trpc.admin.saveTeamMember.useMutation({
    onSuccess: () => {
      toast.success(editingId ? "Team member updated." : "Team member added.");
      setDialogOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const remove = trpc.admin.removeTeamMember.useMutation({
    onSuccess: () => {
      toast.success("Team member removed.");
      setConfirmDeleteId(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const reorder = trpc.admin.reorderTeamMembers.useMutation({
    onError: (err) => toast.error(err.message),
  });

  const list = (members ?? []) as Member[];

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= list.length) return;
    const ids = list.map((m) => m.id);
    [ids[index], ids[j]] = [ids[j], ids[index]];
    reorder.mutate(
      { orderedIds: ids },
      { onSuccess: () => refetch() },
    );
  };

  const toggleActive = (m: Member) => {
    save.mutate(
      {
        id: m.id,
        name: m.name,
        role: m.role,
        bio: m.bio ?? undefined,
        photo: m.photo ?? undefined,
        sortOrder: m.sortOrder,
        isActive: m.isActive === "yes" ? "no" : "yes",
      },
      {
        onSuccess: () => toast.success(m.isActive === "yes" ? `${m.name} hidden from the website.` : `${m.name} is now visible on the website.`),
      },
    );
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sortOrder: list.length });
    setDialogOpen(true);
  };

  const openEdit = (m: Member) => {
    setEditingId(m.id);
    setForm({
      name: m.name,
      role: m.role,
      bio: m.bio ?? "",
      photo: m.photo ?? "",
      sortOrder: m.sortOrder,
      isActive: m.isActive,
    });
    setDialogOpen(true);
  };

  const handlePhotoFile = async (file: File | undefined, input?: HTMLInputElement | null) => {
    if (input) input.value = "";
    if (!file) return;
    setPhotoBusy(true);
    try {
      const { optimizeImage } = await import("@/lib/image-utils");
      const photo = await optimizeImage(file, { maxDimension: 800 });
      setForm((f) => ({ ...f, photo }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not process the image.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.role.trim()) {
      toast.error("Name and role are required.");
      return;
    }
    save.mutate({
      id: editingId ?? undefined,
      name: form.name.trim(),
      role: form.role.trim(),
      bio: form.bio.trim() || undefined,
      photo: form.photo || undefined,
      sortOrder: form.sortOrder,
      isActive: form.isActive,
    });
  };

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-[#26342b] font-serif">Team Section</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage the team members shown in the website's Team section — photos, names, roles and bios.
            The section's design stays exactly the same.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button size="sm" onClick={openAdd} className="bg-[#26342b]">
            <Plus className="w-4 h-4 mr-1.5" /> Add Member
          </Button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No team members yet. Add the first one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((m, i) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 sm:gap-4 border border-gray-200 rounded-2xl p-3 sm:p-4">
              <img
                src={m.photo || "/images/team-1.jpg"}
                alt={m.name}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover shrink-0 border border-gray-200"
              />
              <div className="min-w-0 flex-1 basis-40">
                <p className="font-semibold text-[#26342b] flex items-center gap-2 break-words">
                  <span className="break-words">{m.name}</span>
                  {m.isActive !== "yes" && (
                    <span className="text-[10px] font-bold uppercase bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full shrink-0">Hidden</span>
                  )}
                </p>
                <p className="text-xs text-[#a6632f] font-medium mt-0.5 break-words">{m.role}</p>
                {m.bio && <p className="text-xs text-gray-400 mt-1 line-clamp-2 break-words">{m.bio}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-auto">
                <button title="Move up" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)} className="p-2 rounded-lg text-gray-400 hover:text-[#26342b] hover:bg-gray-100 transition disabled:opacity-30">
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button title="Move down" disabled={i === list.length - 1 || reorder.isPending} onClick={() => move(i, 1)} className="p-2 rounded-lg text-gray-400 hover:text-[#26342b] hover:bg-gray-100 transition disabled:opacity-30">
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button title={m.isActive === "yes" ? "Hide from website" : "Show on website"} onClick={() => toggleActive(m)} className="p-2 rounded-lg text-gray-400 hover:text-[#26342b] hover:bg-gray-100 transition">
                  {m.isActive === "yes" ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button title="Edit" onClick={() => openEdit(m)} className="p-2 rounded-lg text-gray-400 hover:text-[#26342b] hover:bg-gray-100 transition">
                  <Pencil className="w-4 h-4" />
                </button>
                <button title="Remove" onClick={() => setConfirmDeleteId(m.id)} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Team Member" : "Add Team Member"}</DialogTitle>
            <DialogDescription>
              Active members appear in the Team section in the order shown on the previous screen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-4">
              <img
                src={form.photo || "/images/team-1.jpg"}
                alt="Preview"
                className="w-20 h-20 rounded-full object-cover border border-gray-200"
              />
              <div>
                <label className={`inline-flex items-center gap-2 px-4 h-10 rounded-lg border border-gray-300 text-sm font-semibold text-[#26342b] cursor-pointer hover:border-[#26342b] transition ${photoBusy ? "opacity-50 pointer-events-none" : ""}`}>
                  {photoBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  {form.photo ? "Change photo" : "Upload photo"}
                  <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden" onChange={(e) => handlePhotoFile(e.target.files?.[0], e.target)} />
                </label>
                <p className="text-[11px] text-gray-400 mt-1.5">JPG, PNG or WEBP — optimized automatically.</p>
              </div>
            </div>
            <div>
              <Label htmlFor="tm-name">Full Name</Label>
              <Input id="tm-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1.5" maxLength={150} />
            </div>
            <div>
              <Label htmlFor="tm-role">Role / Title</Label>
              <Input id="tm-role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="e.g. Chief Executive Officer" className="mt-1.5" maxLength={150} />
            </div>
            <div>
              <Label htmlFor="tm-bio">Short Bio (optional)</Label>
              <textarea
                id="tm-bio"
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                rows={3}
                maxLength={2000}
                className="mt-1.5 w-full rounded-md border border-input px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="tm-order">Sort Order</Label>
                <Input id="tm-order" type="number" min={0} value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="tm-active">Visibility</Label>
                <select id="tm-active" value={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.value as "yes" | "no" }))} className="mt-1.5 w-full h-10 rounded-md border border-input px-3 text-sm bg-background">
                  <option value="yes">Visible</option>
                  <option value="no">Hidden</option>
                </select>
              </div>
            </div>
            <Button onClick={handleSave} disabled={save.isPending || photoBusy} className="w-full bg-[#26342b]">
              {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingId ? "Save Changes" : "Add Member"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={confirmDeleteId != null} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove this team member?</DialogTitle>
            <DialogDescription>
              The member will be permanently removed from the Team section.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={remove.isPending}
              onClick={() => confirmDeleteId != null && remove.mutate({ id: confirmDeleteId })}
            >
              {remove.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
