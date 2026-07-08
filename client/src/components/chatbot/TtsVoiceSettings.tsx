import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mic, Square, Trash2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { chatbotApi } from "@/lib/api";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  selectedVoiceId?: string;
  onVoiceChange: (voiceId: string) => void;
};

const MIN_RECORD_SEC = 3;
const MAX_RECORD_SEC = 25;

export function TtsVoiceSettings({ tenantId, selectedVoiceId, onVoiceChange }: Props) {
  const queryClient = useQueryClient();
  const [cloneName, setCloneName] = useState("My voice");
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const voicesQuery = useQuery({
    queryKey: ["chatbot-tts-voices", tenantId],
    queryFn: () => chatbotApi.listTtsVoices(tenantId),
    enabled: Boolean(tenantId),
  });

  const voices = voicesQuery.data;

  useEffect(() => {
    if (voices?.selectedVoiceId && !selectedVoiceId) {
      onVoiceChange(voices.selectedVoiceId);
    }
  }, [voices?.selectedVoiceId, selectedVoiceId, onVoiceChange]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      previewAudioRef.current?.pause();
    };
  }, []);

  const cloneVoice = useMutation({
    mutationFn: (file: File) => chatbotApi.cloneTtsVoice(tenantId, cloneName.trim(), file),
    onSuccess: (data) => {
      toast.success("Voice cloned — now available for your agent");
      onVoiceChange(data.selectedVoiceId);
      void queryClient.invalidateQueries({ queryKey: ["chatbot-tts-voices", tenantId] });
      void queryClient.invalidateQueries({ queryKey: ["chatbot-config", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteVoice = useMutation({
    mutationFn: (voiceRowId: string) => chatbotApi.deleteTtsVoice(tenantId, voiceRowId),
    onSuccess: () => {
      toast.success("Custom voice removed");
      void queryClient.invalidateQueries({ queryKey: ["chatbot-tts-voices", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (recordSeconds < MIN_RECORD_SEC) {
          toast.error(`Record at least ${MIN_RECORD_SEC} seconds for voice cloning`);
          return;
        }
        const ext = mimeType.includes("webm") ? "webm" : "audio";
        const file = new File([blob], `voice-sample.${ext}`, { type: mimeType });
        cloneVoice.mutate(file);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(200);
      setRecordSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          if (s + 1 >= MAX_RECORD_SEC) stopRecording();
          return s + 1;
        });
      }, 1000);
    } catch {
      toast.error("Microphone access is required to record your voice");
    }
  };

  const previewVoice = async (voiceId: string) => {
    if (previewingId === voiceId) {
      previewAudioRef.current?.pause();
      setPreviewingId(null);
      return;
    }
    try {
      setPreviewingId(voiceId);
      const blob = await chatbotApi.previewTtsVoice(tenantId, voiceId);
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

  const activeId = selectedVoiceId || voices?.selectedVoiceId || "";

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
        <Label>Agent voice</Label>
        <div className="flex gap-2">
          <Select
            value={activeId || "__default__"}
            onValueChange={(v) => onVoiceChange(v === "__default__" ? "" : v)}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Default (Paul — neutral)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__">Default (Paul — neutral)</SelectItem>
              {voices?.presets?.length ? (
                <SelectGroup>
                  <SelectLabel>Mistral preset voices</SelectLabel>
                  {voices.presets.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                      {v.gender ? ` · ${v.gender}` : ""}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
              {voices?.custom?.length ? (
                <SelectGroup>
                  <SelectLabel>Your cloned voices</SelectLabel>
                  {voices.custom.map((v) => (
                    <SelectItem key={v.mistralVoiceId} value={v.mistralVoiceId}>
                      {v.name} (cloned)
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
            </SelectContent>
          </Select>
          {activeId && activeId !== "__default__" && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Preview voice"
              disabled={previewingId !== null && previewingId !== activeId}
              onClick={() => void previewVoice(activeId)}
            >
              {previewingId === activeId ? (
                <Square className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Used for Listen in the widget and playground when text-to-speech is on.
        </p>
      </div>

      <div className="space-y-3 pt-2 border-t">
        <div>
          <Label>Clone your voice</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Record {MIN_RECORD_SEC}–{MAX_RECORD_SEC} seconds of clear speech. Mistral creates a
            custom voice from your sample (zero-shot cloning).
          </p>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Voice name</Label>
          <Input
            value={cloneName}
            onChange={(e) => setCloneName(e.target.value)}
            placeholder="e.g. Support agent"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!recording ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={cloneVoice.isPending || !cloneName.trim()}
              onClick={() => void startRecording()}
            >
              <Mic className="h-4 w-4 mr-2" />
              Record sample
            </Button>
          ) : (
            <Button type="button" variant="destructive" size="sm" onClick={stopRecording}>
              <Square className="h-4 w-4 mr-2" />
              Stop ({recordSeconds}s)
            </Button>
          )}
          {cloneVoice.isPending && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Cloning voice…
            </span>
          )}
        </div>
      </div>

      {voices?.custom && voices.custom.length > 0 && (
        <div className="space-y-2 pt-2 border-t">
          <Label className="text-xs text-muted-foreground">Your cloned voices</Label>
          <ul className="space-y-1">
            {voices.custom.map((v) => (
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
                    onClick={() => void previewVoice(v.mistralVoiceId)}
                  >
                    <Volume2 className="h-3.5 w-3.5" />
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
