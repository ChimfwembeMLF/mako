import { useState, useEffect, useRef } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Upload as UploadIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MediaPickerProps {
  userId: string;
  value?: string | string[];
  onChange: (url: string | string[]) => void;
  label?: string;
  accept?: string;
  folder?: string;
  multiple?: boolean;
  enableDelete?: boolean;
}

export default function MediaPicker({
  userId,
  value,
  onChange,
  label,
  accept = "image/*",
}: MediaPickerProps) {
  const [uploaded] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>(Array.isArray(value) ? value : value ? [value] : []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setSelected(Array.isArray(value) ? value : value ? [value] : []);
  }, [value]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    toast({
      title: "Coming soon",
      description: "Media uploads are not available yet.",
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSelect(url: string) {
    if (Array.isArray(value)) {
      const exists = selected.includes(url);
      const newSelected = exists ? selected.filter(u => u !== url) : [...selected, url];
      setSelected(newSelected);
      onChange(newSelected);
    } else {
      setSelected([url]);
      onChange(url);
    }
  }

  async function handleDeleteSelected() {
    toast({
      title: "Coming soon",
      description: "Media deletion is not available yet.",
    });
    setSelected([]);
    onChange(Array.isArray(value) ? [] : "");
    setLoading(false);
  }

  return (
    <div className="space-y-2">
      {label && <div className="font-medium text-sm mb-1">{label}</div>}
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={loading}>
          <UploadIcon className="h-4 w-4 mr-1" /> Upload{(typeof value === "object" || Array.isArray(value)) && "s"}
        </Button>
        <Input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleFileChange}
          multiple={!!(typeof value === "object" || Array.isArray(value))}
        />
        {Array.isArray(value) && value.length > 0 && (
          <Button type="button" variant="destructive" onClick={handleDeleteSelected} disabled={loading}>
            Delete Selected
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {loading && <div>Loading...</div>}
        {uploaded.map((url) => (
          <button
            key={url}
            type="button"
            className={`border rounded p-1 ${selected.includes(url) ? "ring-2 ring-primary" : ""}`}
            onClick={() => handleSelect(url)}
            title="Pick this media"
          >
            {url.match(/\.(mp4|webm|mov)$/i) ? (
              <video src={url} className="h-12 w-12 object-cover rounded" />
            ) : (
              <img src={url} className="h-12 w-12 object-cover rounded" alt="media" />
            )}
          </button>
        ))}
      </div>
      {selected.length > 0 && (
        <div className="mt-2">
          <div className="text-xs text-muted-foreground mb-1">Selected:</div>
          <div className="flex gap-2 flex-wrap">
            {selected.map((url) => (
              url.match(/\.(mp4|webm|mov)$/i) ? (
                <video key={url} src={url} className="h-16 w-16 object-cover rounded" controls />
              ) : (
                <img key={url} src={url} className="h-16 w-16 object-cover rounded" alt="selected" />
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export { MediaPicker };
