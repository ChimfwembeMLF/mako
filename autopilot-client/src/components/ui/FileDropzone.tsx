import { useCallback, useRef, useState } from "react";
import { CloudUpload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type FileDropzoneProps = {
  accept?: string;
  hint?: string;
  loading?: boolean;
  disabled?: boolean;
  previewUrl?: string;
  previewAlt?: string;
  emptyIcon?: React.ReactNode;
  onFile: (file: File) => void;
};

export function FileDropzone({
  accept,
  hint = "Drag and drop a file here, or click to browse",
  loading = false,
  disabled = false,
  previewUrl,
  previewAlt = "",
  emptyIcon,
  onFile,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const pickFile = useCallback(
    (file: File | undefined) => {
      if (!file || disabled || loading) return;
      onFile(file);
    },
    [disabled, loading, onFile],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    pickFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => !disabled && !loading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !loading) setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={onDrop}
        className={cn(
          "group relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-all",
          dragOver
            ? "border-primary bg-primary/5 shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]"
            : "border-border/80 bg-muted/30 hover:border-primary/40 hover:bg-muted/50",
          (disabled || loading) && "pointer-events-none opacity-60",
        )}
      >
        {previewUrl ? (
          <div className="flex flex-col items-center gap-3">
            <div className="h-20 w-20 overflow-hidden rounded-2xl border bg-background shadow-sm ring-1 ring-border/50">
              <img src={previewUrl} alt={previewAlt} className="h-full w-full object-cover" />
            </div>
            <p className="text-xs text-muted-foreground">Drop a new image to replace</p>
          </div>
        ) : (
          <>
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
                dragOver ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
              )}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                emptyIcon ?? <CloudUpload className="h-5 w-5" />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {loading ? "Uploading…" : "Upload file"}
              </p>
              <p className="text-xs text-muted-foreground max-w-[240px]">{hint}</p>
            </div>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          disabled={disabled || loading}
          onChange={(e) => {
            pickFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
