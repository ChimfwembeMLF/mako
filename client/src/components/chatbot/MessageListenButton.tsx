import { useRef, useState } from "react";
import { Loader2, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  messageId: string;
  onSpeak: (messageId: string) => Promise<Blob>;
  onSpeechAudio?: (audio: HTMLAudioElement | null) => void;
};

export function MessageListenButton({ messageId, onSpeak, onSpeechAudio }: Props) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    onSpeechAudio?.(null);
    setPlaying(false);
    setLoading(false);
  };

  const handleClick = async () => {
    if (playing) {
      stop();
      return;
    }
    stop();
    setLoading(true);
    try {
      const blob = await onSpeak(messageId);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.addEventListener("ended", stop);
      audio.addEventListener("error", stop);
      setPlaying(true);
      setLoading(false);
      onSpeechAudio?.(audio);
      await audio.play();
    } catch {
      stop();
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 px-2.5 text-xs gap-1.5 mt-2"
      disabled={loading}
      onClick={() => void handleClick()}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : playing ? (
        <Square className="h-3.5 w-3.5" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
      {loading ? "Loading…" : playing ? "Stop" : "Listen"}
    </Button>
  );
}
