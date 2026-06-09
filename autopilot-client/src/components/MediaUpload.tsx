import { useRef, useState, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LibraryFile {
  id: string;
  url: string;
  type: "image" | "video";
  name: string | null;
}

interface MediaUploadProps {
  onUpload: (url: string, type: "image" | "video", existingId?: string) => void;
  label?: string;
  disabled?: boolean;
}

export function MediaUpload({ onUpload, label, disabled }: MediaUploadProps) {
  const { tenant } = useTenant();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [libraryFiles] = useState<LibraryFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAddSelected() {
    libraryFiles
      .filter((f) => selected.has(f.id))
      .forEach((f) => onUpload(f.url, f.type, f.id));
    setSelected(new Set());
  }

  const showComingSoon = useCallback(() => {
    toast({
      title: "Coming soon",
      description: "Media library uploads are not available yet.",
    });
  }, [toast]);

  const uploadFile = useCallback(async (_file: File) => {
    if (!tenant) return;
    setUploading(true);
    showComingSoon();
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [tenant, showComingSoon]);

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
        <div className="text-xs text-muted-foreground">No media uploaded yet.</div>
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
