import { useState } from "react";
import {
  Building2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Star, Trash2, Upload, Plus, Loader2, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { formatCurrency } from "@/hooks/use-investor";

function parseImages(raw: any): string[] {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export default function AdminPropertyMedia() {
  const { data: properties, refetch } = trpc.admin.properties.useQuery(undefined, { retry: false });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [draftImages, setDraftImages] = useState<Record<number, string[]>>({});
  const [busy, setBusy] = useState(false);

  const updateImages = trpc.admin.updatePropertyImages.useMutation({
    onSuccess: (data) => {
      toast.success(`Images updated for ${data.product.name} — the change is live everywhere the property appears.`);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const imagesFor = (p: any): string[] => draftImages[p.id] ?? parseImages(p.images);
  const setImages = (p: any, imgs: string[]) => setDraftImages((prev) => ({ ...prev, [p.id]: imgs }));
  const isDirty = (p: any) => JSON.stringify(imagesFor(p)) !== JSON.stringify(parseImages(p.images));

  const handleFiles = async (p: any, files: FileList | null, replaceIndex?: number) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const { optimizeImage } = await import("@/lib/image-utils");
      const imgs = [...imagesFor(p)];
      if (replaceIndex != null) {
        const file = files[0];
        imgs[replaceIndex] = await optimizeImage(file, { maxDimension: 1600 });
      } else {
        for (const file of Array.from(files)) {
          if (imgs.length >= 12) {
            toast.error("A home can have at most 12 images.");
            break;
          }
          imgs.push(await optimizeImage(file, { maxDimension: 1600 }));
        }
      }
      setImages(p, imgs);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not process the image.");
    } finally {
      setBusy(false);
    }
  };

  const move = (p: any, index: number, dir: -1 | 1) => {
    const imgs = [...imagesFor(p)];
    const j = index + dir;
    if (j < 0 || j >= imgs.length) return;
    [imgs[index], imgs[j]] = [imgs[j], imgs[index]];
    setImages(p, imgs);
  };

  const setPrimary = (p: any, index: number) => {
    const imgs = [...imagesFor(p)];
    const [img] = imgs.splice(index, 1);
    imgs.unshift(img);
    setImages(p, imgs);
  };

  const removeImage = (p: any, index: number) => {
    const imgs = imagesFor(p).filter((_, i) => i !== index);
    setImages(p, imgs);
  };

  const save = (p: any) => {
    const imgs = imagesFor(p);
    const confirmed = window.confirm(
      `Save ${imgs.length} image(s) for ${p.name}?\n\nThe first image becomes the primary photo. The update applies everywhere this property appears (catalog, details, cards, search).`,
    );
    if (!confirmed) return;
    updateImages.mutate({ productId: p.id, images: imgs });
  };

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-[#26342b] font-serif">Home Media</h2>
          <p className="text-sm text-gray-500 mt-1">
            Add, replace, reorder or remove photos for each home. The first image is the primary photo.
            Changes go live everywhere immediately — there is only one copy of each home.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="shrink-0">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {!properties || properties.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No homes found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {properties.map((p: any) => {
            const imgs = imagesFor(p);
            const expanded = expandedId === p.id;
            return (
              <div key={p.id} className="border border-gray-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpandedId(expanded ? null : p.id)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-[#f7f4ee] transition text-left"
                >
                  <img
                    src={imgs[0] || "/images/home-exterior-1.jpg"}
                    alt={p.name}
                    className="w-16 h-16 rounded-xl object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#26342b] truncate">{p.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatCurrency(Number(p.price))} · {imgs.length} image{imgs.length === 1 ? "" : "s"}
                      {isDirty(p) && <span className="text-amber-600 font-semibold ml-2">• unsaved changes</span>}
                    </p>
                  </div>
                  {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>

                {expanded && (
                  <div className="border-t border-gray-100 p-4 bg-[#f7f4ee]">
                    {imgs.length === 0 ? (
                      <p className="text-sm text-gray-500 mb-4">No images yet — upload the first photo below.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
                        {imgs.map((img, i) => (
                          <div key={i} className="relative group">
                            <img src={img} alt={`${p.name} ${i + 1}`} className="w-full h-32 object-cover rounded-xl border border-gray-200" />
                            {i === 0 && (
                              <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-[#c47a45] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                <Star className="w-3 h-3 fill-current" /> Primary
                              </span>
                            )}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-xl flex items-center justify-center gap-1.5">
                              <label
                                title="Replace image"
                                className="p-2 rounded-lg bg-white/90 text-[#26342b] cursor-pointer hover:bg-white"
                              >
                                <Upload className="w-4 h-4" />
                                <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden" onChange={(e) => handleFiles(p, e.target.files, i)} />
                              </label>
                              {i !== 0 && (
                                <button title="Set as primary" onClick={() => setPrimary(p, i)} className="p-2 rounded-lg bg-white/90 text-[#c47a45] hover:bg-white">
                                  <Star className="w-4 h-4" />
                                </button>
                              )}
                              <button title="Move left" disabled={i === 0} onClick={() => move(p, i, -1)} className="p-2 rounded-lg bg-white/90 text-[#26342b] hover:bg-white disabled:opacity-40">
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              <button title="Move right" disabled={i === imgs.length - 1} onClick={() => move(p, i, 1)} className="p-2 rounded-lg bg-white/90 text-[#26342b] hover:bg-white disabled:opacity-40">
                                <ChevronRight className="w-4 h-4" />
                              </button>
                              <button
                                title="Remove image"
                                onClick={() => {
                                  if (window.confirm("Remove this image?")) removeImage(p, i);
                                }}
                                className="p-2 rounded-lg bg-white/90 text-red-500 hover:bg-white"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      <label className={`inline-flex items-center gap-2 px-4 h-10 rounded-lg border-2 border-dashed border-gray-300 text-sm font-semibold text-[#26342b] cursor-pointer hover:border-[#26342b] transition ${busy ? "opacity-50 pointer-events-none" : ""}`}>
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Add image{imgs.length > 0 ? "s" : ""}
                        <input type="file" multiple accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden" onChange={(e) => handleFiles(p, e.target.files)} />
                      </label>
                      <Button
                        onClick={() => save(p)}
                        disabled={!isDirty(p) || updateImages.isPending || busy}
                        className="bg-[#26342b]"
                      >
                        {updateImages.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Save Images
                      </Button>
                      {isDirty(p) && (
                        <Button variant="outline" onClick={() => setDraftImages((prev) => { const n = { ...prev }; delete n[p.id]; return n; })}>
                          Discard changes
                        </Button>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-3">
                      Photos are optimized in your browser before saving (max 1600px, JPEG). The first image is the
                      primary photo shown on home cards and the catalog.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
