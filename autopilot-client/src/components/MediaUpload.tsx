import { useRef, useState, useCallback, useEffect } from "react";
import { useTenant } from "@/hooks/useTenant";
import { mediaApi } from "@/lib/api";
import { normalizeMediaAsset, resolveMediaUrl, type MediaAsset } from "@/lib/mediaUrl";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MediaUploadProps {
  onUpload: (url: string, type: "image" | "video", existingId?: string) => void;
  label?: string;
  disabled?: boolean;
  contentId?: string;
}

export function MediaUpload({ onUpload, label, disabled, contentId }: MediaUploadProps) {
  const { tenant } = useTenant();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [libraryFiles, setLibraryFiles] = useState<MediaAsset[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadLibrary = useCallback(async () => {
    if (!tenant) return;
    try {
      const rows = await mediaApi.findAll(tenant.id);
      setLibraryFiles(
        (Array.isArray(rows) ? rows : []).map((r) =>
          normalizeMediaAsset(r as Record<string, unknown>),
        ),
      );
    } catch {
      setLibraryFiles([]);
    }
  }, [tenant]);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAddSelected() {
    const picked = libraryFiles.filter((f) => selected.has(f.id));
    if (!picked.length) return;
    picked.forEach((f) => {
      const type = f.mediaType === "video" ? "video" : "image";
      onUpload(f.mediaUrl, type, f.id);
    });
    setSelected(new Set());
    toast({ title: `Added ${picked.length} from library` });
  }

  const uploadFile = useCallback(async (file: File) => {
    if (!tenant) return;
    setUploading(true);
    try {
      const asset = await mediaApi.upload(file, tenant.id, contentId);
      const normalized = normalizeMediaAsset(asset as Record<string, unknown>);
      const type = normalized.mediaType === "video" ? "video" : "image";
      onUpload(normalized.mediaUrl, type, normalized.id);
      setLibraryFiles((prev) => [normalized, ...prev]);
      toast({ title: "Upload complete" });
    } catch (err: unknown) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [tenant, contentId, onUpload, toast]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    Array.from(e.dataTransfer.files).forEach((f) => uploadFile(f));
  };

  return (
    <div className="space-y-3">
      {label && <Label>{label}</Label>}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Media Library</span>
          {selected.size > 0 && (
            <Button size="sm" className="h-7 text-xs" onClick={handleAddSelected}>
              Add Selected ({selected.size})
            </Button>
          )}
        </div>
        {libraryFiles.length === 0 ? (
          <div className="text-xs text-muted-foreground">No media uploaded yet.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {libraryFiles.slice(0, 12).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelect(f.id);
                }}
                className={`relative w-14 h-14 rounded-md border overflow-hidden ${selected.has(f.id) ? "ring-2 ring-primary" : ""}`}
              >
                {f.mediaType === "video" ? (
                  <div className="w-full h-full bg-muted flex items-center justify-center text-[10px]">Video</div>
                ) : (
                  <img src={resolveMediaUrl(f.mediaUrl)} alt="" className="w-full h-full object-cover" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded p-4 text-center cursor-pointer text-xs transition ${
          dragOver ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
        }`}
        style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : undefined }}
      >
        {uploading
          ? <span className="flex items-center justify-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</span>
          : "Drag & drop or click to upload new files"}
        <Input
          type="file"
          accept="image/*,video/*"
          ref={fileInputRef}
          className="hidden"
          multiple
          onChange={(e) => Array.from(e.target.files || []).forEach((f) => uploadFile(f))}
          disabled={uploading || disabled}
        />
      </div>
    </div>
  );
}
