import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Square, Trash2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { chatbotApi } from "@/lib/api";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  tenantId: string;
  selectedDescription?: string;
  onDescriptionChange: (description: string) => void;
};

export function ParlerVoiceSettings({ tenantId, selectedDescription, onDescriptionChange }: Props) {
  const queryClient = useQueryClient();
  const [profileName, setProfileName] = useState("");
  const [voiceDescription, setVoiceDescription] = useState("");
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const voicesQuery = useQuery({
    queryKey: ["chatbot-tts-voices", tenantId],
    queryFn: () => chatbotApi.listTtsVoices(tenantId),
    enabled: Boolean(tenantId),
  });

  const voices = voicesQuery.data;

  useEffect(() => {
    return () => {
      previewAudioRef.current?.pause();
    };
  }, []);

  const addVoice = useMutation({
    mutationFn: () => chatbotApi.addParlerVoice(tenantId, profileName, voiceDescription),
    onSuccess: (data) => {
      toast.success("Voice profile saved successfully");
      onDescriptionChange(data.selectedDescription);
      setProfileName("");
      setVoiceDescription("");
      void queryClient.invalidateQueries({ queryKey: ["chatbot-tts-voices", tenantId] });
      void queryClient.invalidateQueries({ queryKey: ["chatbot-config", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteVoice = useMutation({
    mutationFn: (voiceRowId: string) => chatbotApi.deleteTtsVoice(tenantId, voiceRowId),
    onSuccess: () => {
      toast.success("Voice profile removed");
      void queryClient.invalidateQueries({ queryKey: ["chatbot-tts-voices", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const previewVoice = async (id: string, description: string) => {
    if (previewingId === id) {
      previewAudioRef.current?.pause();
      setPreviewingId(null);
      return;
    }
    try {
      setPreviewingId(id);
      const blob = await chatbotApi.previewTtsVoice(tenantId, undefined, description);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setPreviewingId(null);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setPreviewingId(null);
      };
      await audio.play();
    } catch (e) {
      setPreviewingId(null);
      toast.error(e instanceof Error ? e.message : "Preview failed");
    }
  };
  
  const previewDraft = async () => {
    if (!voiceDescription.trim()) return;
    if (previewingId === "draft") {
      previewAudioRef.current?.pause();
      setPreviewingId(null);
      return;
    }
    try {
      setPreviewingId("draft");
      const blob = await chatbotApi.previewTtsVoice(tenantId, undefined, voiceDescription.trim());
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setPreviewingId(null);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setPreviewingId(null);
      };
      await audio.play();
    } catch (e) {
      setPreviewingId(null);
      toast.error(e instanceof Error ? e.message : "Preview failed");
    }
  };

  const parlerVoices = voices?.custom?.filter(v => !!v.parlerVoiceDescription) || [];

  if (voicesQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading voices…
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
      <div className="space-y-2">
        <Label>Agent voice profile</Label>
        <div className="flex gap-2">
          <Select
            value={selectedDescription || "__default__"}
            onValueChange={(v) => onDescriptionChange(v === "__default__" ? "" : v)}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Default (None)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__">Default (None)</SelectItem>
              {parlerVoices.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Saved Voice Profiles</SelectLabel>
                  {parlerVoices.map((v) => (
                    <SelectItem key={v.id} value={v.parlerVoiceDescription!}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
          
          {selectedDescription && selectedDescription !== "__default__" && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Preview selected voice"
              disabled={previewingId !== null && previewingId !== "selected"}
              onClick={() => {
                if (previewingId === "selected") {
                   previewAudioRef.current?.pause();
                   setPreviewingId(null);
                } else {
                   setPreviewingId("selected");
                   previewVoice("selected", selectedDescription).finally(() => {
                       if (previewingId === "selected") setPreviewingId(null);
                   });
                }
              }}
            >
              {previewingId === "selected" ? (
                <Square className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          This description prompt guides the Self-Hosted Parler model on how to sound.
        </p>
      </div>

      <div className="space-y-3 pt-2 border-t">
        <div>
          <Label>Create new profile</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Define a character or tone (e.g., "A friendly female voice speaking clearly")
          </p>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Profile name</Label>
          <Input
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder="e.g. Professional Announcer"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Description prompt</Label>
          <Textarea
            value={voiceDescription}
            onChange={(e) => setVoiceDescription(e.target.value)}
            placeholder="A professional male announcer..."
            rows={3}
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
           <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!voiceDescription.trim()}
              onClick={() => void previewDraft()}
            >
              {previewingId === "draft" ? <Square className="h-4 w-4 mr-2" /> : <Volume2 className="h-4 w-4 mr-2" />}
              {previewingId === "draft" ? "Stop" : "Preview"}
            </Button>
            
          <Button
            type="button"
            size="sm"
            disabled={addVoice.isPending || !profileName.trim() || !voiceDescription.trim()}
            onClick={() => void addVoice.mutate()}
          >
            <Plus className="h-4 w-4 mr-2" />
            Save Profile
          </Button>

          {addVoice.isPending && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          )}
        </div>
      </div>

      {parlerVoices.length > 0 && (
        <div className="space-y-2 pt-2 border-t">
          <Label className="text-xs text-muted-foreground">Your saved profiles</Label>
          <ul className="space-y-1">
            {parlerVoices.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-2 text-sm rounded-md px-2 py-1.5 hover:bg-muted/60"
              >
                <span className="truncate">{v.name}</span>
                <div className="flex gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => void previewVoice(v.id, v.parlerVoiceDescription!)}
                  >
                    {previewingId === v.id ? <Square className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    disabled={deleteVoice.isPending}
                    onClick={() => deleteVoice.mutate(v.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
