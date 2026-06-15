import { useRef, useState } from "react";
import { FileText, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { brandProfilesApi } from "@/lib/api";
import { useTenant } from "@/hooks/useTenant";

interface DocumentUploadProps {
  onResult: (data: Record<string, string>) => void;
  disabled?: boolean;
  workspaceId?: string | null;
}

export function DocumentUpload({ onResult, disabled, workspaceId }: DocumentUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { tenant } = useTenant();
  const { toast } = useToast();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
  }

  async function handleSubmit() {
    if (!selectedFile || !tenant?.id) return;

    setUploading(true);
    try {
      const data = await brandProfilesApi.parseDocument(selectedFile, tenant.id, workspaceId ?? undefined);
      onResult(data);
      toast({
        title: "Document parsed",
        description: "Review the extracted fields and save your Brand Brain.",
      });
    } catch (e: unknown) {
      toast({
        title: "Parse failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={handleChange}
        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
      />
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || uploading}
          className="justify-start sm:flex-1"
        >
          <Upload className="mr-2 h-4 w-4 shrink-0" />
          {selectedFile ? selectedFile.name : "Choose PDF, DOCX, or TXT"}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!selectedFile || !tenant || uploading || disabled}
          variant="outline"
          className="shrink-0"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Parsing…
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Auto-fill
            </>
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Upload a brand guide, pitch deck, or company doc — AI extracts your Brand Brain fields.
      </p>
    </div>
  );
}
