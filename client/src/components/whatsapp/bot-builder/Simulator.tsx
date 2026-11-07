import { useEffect, useRef, useState } from 'react';
import { Loader2, RotateCcw, Send, X, ListTree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { whatsappBotsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { BotGraph, BotSessionState, OutboundMessage } from './types';

type ChatItem =
  | { from: 'customer'; text: string }
  | { from: 'bot'; message: OutboundMessage }
  | { from: 'system'; text: string };

/**
 * Test chat for the builder. Runs the graph on screen through the real bot engine,
 * without sending to WhatsApp, saving leads or calling custom actions.
 */
export function Simulator({ botId, graph, onClose }: { botId: string; graph: BotGraph; onClose: () => void }) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [state, setState] = useState<BotSessionState | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [trace, setTrace] = useState<string[]>([]);
  const [showTrace, setShowTrace] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [items]);

  const send = async (body: string, interactiveId?: string) => {
    if (!body.trim() && !interactiveId) return;
    setItems((prev) => [...prev, { from: 'customer', text: body }]);
    setText('');
    setBusy(true);
    try {
      const res = await whatsappBotsApi.test(botId, { text: body, interactiveId, graph, state });
      const next: ChatItem[] = res.messages.map((m) => ({ from: 'bot' as const, message: m }));
      for (const a of res.agentActions) next.push({ from: 'system', text: `${a.ok ? '✓' : '✗'} ${a.name}: ${a.detail}` });
      if (res.lead) next.push({ from: 'system', text: `Lead would be updated: ${[res.lead.name, res.lead.email].filter(Boolean).join(', ') || 'notes'}` });
      if (res.handoff) next.push({ from: 'system', text: 'Handed to a person. The bot now stays quiet for 24 hours.' });
      else if (res.ended) next.push({ from: 'system', text: 'Conversation ended. Send a message to start again.' });
      setItems((prev) => [...prev, ...next]);
      setTrace((prev) => [...prev, `— "${body}"`, ...res.trace]);
      setState(res.ended || res.handoff ? null : res.state);
    } catch (err) {
      setItems((prev) => [...prev, { from: 'system', text: err instanceof Error ? err.message : 'Test failed' }]);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setItems([]);
    setState(null);
    setTrace([]);
  };

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden border-l border-border bg-card" aria-label="Test chat">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Test chat</p>
          <p className="text-xs text-muted-foreground">Uses your unsaved changes. Nothing is sent or saved.</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowTrace((v) => !v)} aria-pressed={showTrace} title="What happened"><ListTree className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={reset} title="Start over"><RotateCcw className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close test chat"><X className="h-4 w-4" /></Button>
      </div>

      {showTrace && (
        <ol className="max-h-40 space-y-0.5 overflow-y-auto border-b border-border bg-muted/40 px-4 py-2 font-mono text-[11px] text-muted-foreground">
          {trace.length === 0 ? <li>Nothing yet.</li> : trace.map((t, i) => <li key={i}>{t}</li>)}
        </ol>
      )}

      <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto bg-[#efeae2] p-3 dark:bg-[#0b141a]">
        {items.length === 0 && (
          <p className="mx-auto mt-8 max-w-[220px] rounded-lg bg-card/90 px-3 py-2 text-center text-xs text-muted-foreground">
            Send a message as a customer would, e.g. one of this bot's keywords.
          </p>
        )}
        {items.map((item, i) => {
          if (item.from === 'system') {
            return <p key={i} className="mx-auto max-w-[90%] rounded-md bg-amber-100 px-2 py-1 text-center text-[11px] text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">{item.text}</p>;
          }
          if (item.from === 'customer') {
            return (
              <div key={i} className="flex justify-end">
                <p className="max-w-[80%] whitespace-pre-wrap rounded-lg rounded-tr-sm bg-[#d9fdd3] px-3 py-1.5 text-sm text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-white">{item.text}</p>
              </div>
            );
          }
          const m = item.message;
          const live = i === items.length - 1 || items.slice(i + 1).every((x) => x.from !== 'customer');
          return (
            <div key={i} className="flex max-w-[85%] flex-col gap-1">
              <p className="whitespace-pre-wrap rounded-lg rounded-tl-sm bg-white px-3 py-1.5 text-sm text-[#111b21] shadow-sm dark:bg-[#202c33] dark:text-white">{m.body}</p>
              {m.kind === 'buttons' && m.buttons.map((b) => (
                <button key={b.id} type="button" disabled={busy || !live}
                  onClick={() => void send(b.title, b.id)}
                  className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-[#027eb5] shadow-sm hover:bg-white/80 disabled:opacity-60 dark:bg-[#202c33] dark:text-[#53bdeb]">
                  {b.title}
                </button>
              ))}
              {m.kind === 'list' && (
                <div className="overflow-hidden rounded-lg bg-white shadow-sm dark:bg-[#202c33]">
                  <p className="border-b border-black/5 px-3 py-1.5 text-center text-xs font-semibold text-[#027eb5] dark:text-[#53bdeb]">{m.buttonLabel}</p>
                  {m.sections.flatMap((s) => s.rows).map((r) => (
                    <button key={r.id} type="button" disabled={busy || !live}
                      onClick={() => void send(r.title, r.id)}
                      className="block w-full px-3 py-1.5 text-left text-sm text-[#111b21] hover:bg-black/5 disabled:opacity-60 dark:text-white dark:hover:bg-white/5">
                      {r.title}
                      {r.description && <span className="block text-xs text-muted-foreground">{r.description}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Bot is replying" />}
      </div>

      <form className="flex gap-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" aria-label="Message" disabled={busy} />
        <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button>
      </form>
    </aside>
  );
}
