import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";

interface DocumentUploadProps {
  onResult: (data: any) => void;
}

export function DocumentUpload({ onResult }: DocumentUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
  }

  async function handleSubmit() {
    if (!selectedFile) return;

    try {
      const { data, error } = await invokeEdgeFunction("parse-brand-document", {
        body: { fileName: selectedFile.name },
      });

      if (error) throw error;
      if (!data) throw new Error("No data returned");

      onResult(data);
    } catch (e: any) {
      toast({
        title: "Parse failed",
        description: e.message,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-2 space-x-2">
      <Input type="file" ref={fileRef} onChange={handleChange} />
      <Button onClick={() => fileRef.current?.click()} type="button">
        Choose File
      </Button>
      <Button onClick={handleSubmit} disabled={!selectedFile}>
        Submit
      </Button>
    </div>
  );
}
