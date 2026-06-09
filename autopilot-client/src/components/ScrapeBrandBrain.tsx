import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";

interface ScrapeBrandBrainProps {
  onResult: (data: Partial<Record<string, string>>) => void;
}

export function ScrapeBrandBrain({ onResult }: ScrapeBrandBrainProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleScrape() {
    setLoading(true);
    try {
      const { data, error } = await invokeEdgeFunction("scrape-brand", {
        body: { url },
      });

      if (error) throw error;
      if (!data) throw new Error("No data returned");

      onResult(data as Partial<Record<string, string>>);
      toast({ title: "Brand info loaded!" });
    } catch (e: any) {
      toast({
        title: "Scrape failed",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Company Website</label>
      <Input
        placeholder="https://company.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={loading}
      />
      <Button onClick={handleScrape} disabled={loading || !url.trim()}>
        {loading ? "Scraping..." : "Scrape Website"}
      </Button>
    </div>
  );
}
