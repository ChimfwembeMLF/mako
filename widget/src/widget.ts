import { WidgetApi, type ChatCitation } from './api';
import { initAvatarSystem } from './avatar/init';
import { parseAvatarTheme } from './avatar/types';
import { renderChatMarkdown } from './markdown';
import { resolveWidgetTheme } from './theme';

export type WidgetMessage = {
  role: 'user' | 'assistant';
  content: string;
  citations?: ChatCitation[];
  messageId?: string;
};

export type WidgetMountOptions = {
  api: WidgetApi;
  config: {
    name: string;
    welcomeMessage?: string;
    theme: Record<string, unknown>;
    ttsEnabled?: boolean;
    suggestions?: string[];
  };
  sessionId: string;
  visitorId: string;
  welcomeMessageId?: string;
  widgetBase: string;
  host: HTMLElement;
  position?: string;
};

const STYLES = `
:host { all: initial; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.ap-wrap { position: fixed; z-index: 2147483000; display: flex; flex-direction: column; align-items: flex-end; }
.ap-wrap.bl { left: 20px; align-items: flex-start; }
.ap-wrap.br { right: 20px; }
.ap-launcher-wrap { position: relative; }
.ap-launcher {
  width: 58px; height: 58px; border-radius: 50%; border: none; cursor: pointer;
  background: var(--ap-gradient, var(--ap-primary, #6366f1)); color: #fff;
  box-shadow: 0 8px 32px rgba(0,0,0,.22), 0 0 0 0 rgba(99,102,241,.45);
  font-size: 24px; display: flex; align-items: center; justify-content: center;
  transition: transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .25s ease;
  animation: ap-launcher-idle 3s ease-in-out infinite;
}
.ap-wrap:not(.open) .ap-launcher:hover { transform: scale(1.06); box-shadow: 0 10px 36px rgba(0,0,0,.28); }
.ap-wrap.open .ap-launcher { transform: scale(0.92); animation: none; box-shadow: 0 4px 20px rgba(0,0,0,.18); }
.ap-launcher-ring {
  position: absolute; inset: -4px; border-radius: 50%; border: 2px solid var(--ap-primary, #6366f1);
  opacity: 0; pointer-events: none; animation: ap-ring 2.4s ease-out infinite;
}
.ap-wrap.open .ap-launcher-ring { display: none; }
@keyframes ap-launcher-idle { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
@keyframes ap-ring { 0%{transform:scale(.9);opacity:.55} 100%{transform:scale(1.35);opacity:0} }
.ap-panel {
  display: flex; flex-direction: column; width: 392px; max-width: calc(100vw - 32px);
  height: 540px; max-height: calc(100vh - 100px); background: #fff; border-radius: 20px;
  box-shadow: 0 20px 60px rgba(15,23,42,.18), 0 0 0 1px rgba(15,23,42,.06);
  overflow: hidden; margin-bottom: 14px;
  opacity: 0; transform: translateY(16px) scale(.96); pointer-events: none;
  transition: opacity .28s ease, transform .32s cubic-bezier(.22,1,.36,1);
  transform-origin: bottom right;
}
.ap-wrap.bl .ap-panel { transform-origin: bottom left; }
.ap-wrap.open .ap-panel { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
.ap-header {
  padding: 14px 16px; background: var(--ap-gradient, var(--ap-primary, #6366f1)); color: #fff;
  font-weight: 600; font-size: 15px; display: flex; align-items: center; gap: 10px; flex-shrink: 0;
}
.ap-header-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap-header img { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; background: rgba(255,255,255,.2); flex-shrink: 0; }
.ap-header-close {
  flex-shrink: 0; width: 32px; height: 32px; border: none; border-radius: 10px;
  background: rgba(255,255,255,.18); color: #fff; cursor: pointer; font-size: 18px; line-height: 1;
  display: flex; align-items: center; justify-content: center;
  transition: background .15s ease;
}
.ap-header-close:hover { background: rgba(255,255,255,.32); }
.ap-launcher img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.ap-messages { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 8px; scroll-behavior: smooth; }
.ap-msg-list { display: flex; flex-direction: column; gap: 10px; }
.ap-msg {
  max-width: 88%; padding: 10px 14px; border-radius: 16px; font-size: 14px; line-height: 1.5;
  animation: ap-msg-in .28s ease both;
}
@keyframes ap-msg-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
.ap-msg.user { align-self: flex-end; background: var(--ap-gradient, var(--ap-primary, #6366f1)); color: #fff; border-bottom-right-radius: 5px; }
.ap-msg.bot { align-self: flex-start; background: #f1f5f9; color: #0f172a; border-bottom-left-radius: 5px; }
.ap-md { word-break: break-word; }
.ap-md p { margin: 0 0 0.5em; }
.ap-md p:last-child { margin-bottom: 0; }
.ap-md ul, .ap-md ol { margin: 0.35em 0; padding-left: 1.25em; }
.ap-md code { background: rgba(15,23,42,.08); padding: 0.1em 0.35em; border-radius: 4px; font-size: 0.9em; }
.ap-md a { color: var(--ap-primary, #6366f1); }
.ap-cite { font-size: 10px; opacity: .75; margin-top: 4px; }
.ap-msg-actions { display: flex; gap: 6px; margin-top: 6px; }
.ap-tts {
  border: 1px solid rgba(15,23,42,.12); background: #fff; cursor: pointer;
  padding: 4px 10px; font-size: 12px; font-weight: 500; color: #334155;
  border-radius: 999px;
}
.ap-tts.playing { color: var(--ap-primary, #6366f1); border-color: var(--ap-primary, #6366f1); }
.ap-suggestions {
  display: flex; flex-wrap: wrap; gap: 6px; padding: 0 14px 10px; flex-shrink: 0;
  min-height: 0; transition: opacity .2s ease;
}
.ap-suggestions.hidden { opacity: 0; pointer-events: none; height: 0; padding: 0 14px; overflow: hidden; }
.ap-suggest {
  border: 1px solid #e2e8f0; background: #f8fafc; color: #334155;
  font-size: 12px; line-height: 1.35; padding: 7px 11px; border-radius: 999px;
  cursor: pointer; text-align: left; max-width: 100%;
  transition: background .15s ease, border-color .15s ease, transform .15s ease;
}
.ap-suggest:hover { background: #fff; border-color: var(--ap-primary, #6366f1); color: var(--ap-primary, #6366f1); transform: translateY(-1px); }
.ap-suggest:disabled { opacity: .5; cursor: not-allowed; transform: none; }
.ap-input-row {
  display: flex; gap: 8px; padding: 10px 12px 12px; border-top: 1px solid #e2e8f0;
  background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
}
.ap-input {
  flex: 1; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px;
  font-size: 14px; resize: none; font-family: inherit; min-height: 42px;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.ap-input:focus { outline: none; border-color: var(--ap-primary, #6366f1); box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
.ap-send {
  border: none; border-radius: 12px; padding: 0 16px; min-width: 64px;
  background: var(--ap-gradient, var(--ap-primary, #6366f1));
  color: #fff; cursor: pointer; font-weight: 600; font-size: 14px;
  transition: opacity .15s ease, transform .15s ease;
}
.ap-send:hover:not(:disabled) { opacity: .92; transform: translateY(-1px); }
.ap-send:disabled { opacity: .55; cursor: not-allowed; }
.ap-typing { display: flex; gap: 4px; padding: 10px 14px; align-self: flex-start; }
.ap-typing span { width: 7px; height: 7px; border-radius: 50%; background: #94a3b8; animation: ap-bounce 1s infinite; }
.ap-typing span:nth-child(2) { animation-delay: .15s; }
.ap-typing span:nth-child(3) { animation-delay: .3s; }
@keyframes ap-bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
@media (max-width: 480px) {
  .ap-panel { width: 100vw; height: 72vh; max-width: 100vw; border-radius: 20px 20px 0 0; margin-bottom: 0; }
  .ap-wrap.br, .ap-wrap.bl { left: 0; right: 0; bottom: 0; align-items: stretch; }
  .ap-launcher-wrap { align-self: flex-end; margin: 0 16px 16px; }
  .ap-wrap.bl .ap-launcher-wrap { align-self: flex-start; }
}
`;

export function mountWidget(opts: WidgetMountOptions): { destroy: () => void } {
  const shadow = opts.host.attachShadow({ mode: 'open' });
  const { primary, gradient } = resolveWidgetTheme(opts.config.theme ?? {});
  const position = (opts.position as string) || (opts.config.theme?.position as string) || 'bottom-right';
  const posClass = position.includes('left') ? 'bl' : 'br';
  const avatarConfig = parseAvatarTheme(opts.config.theme ?? {}, opts.widgetBase);
  const use3dAvatar = avatarConfig.mode === '3d' || avatarConfig.mode === 'ar';

  const style = document.createElement('style');
  style.textContent = STYLES;
  shadow.appendChild(style);

  const wrap = document.createElement('div');
  wrap.className = `ap-wrap ${posClass}`;
  wrap.style.setProperty('--ap-primary', primary);
  wrap.style.setProperty('--ap-gradient', gradient);
  shadow.appendChild(wrap);

  const avatarUrl = opts.config.theme?.avatarUrl as string | undefined;
  const headerAvatar = avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="" />` : '';

  const panel = document.createElement('div');
  panel.className = 'ap-panel';
  panel.innerHTML = `
    <div class="ap-header">
      ${headerAvatar}
      <span class="ap-header-title">${escapeHtml(opts.config.name)}</span>
      <button type="button" class="ap-header-close" aria-label="Close chat">×</button>
    </div>
    <div class="ap-messages" role="log" aria-live="polite"><div class="ap-msg-list"></div></div>
    <div class="ap-suggestions" role="group" aria-label="Suggested prompts"></div>
    <div class="ap-input-row">
      <textarea class="ap-input" rows="1" placeholder="Ask anything…" aria-label="Message"></textarea>
      <button type="button" class="ap-send">Send</button>
    </div>
  `;
  wrap.appendChild(panel);

  const launcherWrap = document.createElement('div');
  launcherWrap.className = 'ap-launcher-wrap';
  const launcherRing = document.createElement('span');
  launcherRing.className = 'ap-launcher-ring';
  launcherWrap.appendChild(launcherRing);
  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'ap-launcher';
  launcher.setAttribute('aria-label', 'Open chat');
  launcher.setAttribute('aria-expanded', 'false');
  if (avatarUrl) {
    const img = document.createElement('img');
    img.src = avatarUrl;
    img.alt = '';
    launcher.appendChild(img);
  } else {
    launcher.textContent = '💬';
  }
  launcherWrap.appendChild(launcher);
  wrap.appendChild(launcherWrap);

  const headerEl = panel.querySelector('.ap-header')!;
  const closeBtn = panel.querySelector('.ap-header-close') as HTMLButtonElement;
  const messagesEl = panel.querySelector('.ap-messages')!;
  const msgListEl = panel.querySelector('.ap-msg-list')!;
  const suggestionsEl = panel.querySelector('.ap-suggestions') as HTMLDivElement;
  const input = panel.querySelector('.ap-input') as HTMLTextAreaElement;
  const sendBtn = panel.querySelector('.ap-send') as HTMLButtonElement;

  const messages: WidgetMessage[] = [];
  const ttsEnabled = opts.config.ttsEnabled ?? false;
  let currentAudio: HTMLAudioElement | null = null;
  let speakingMessageId: string | null = null;
  let ttsLoadingId: string | null = null;
  let avatarRuntime: Awaited<ReturnType<typeof initAvatarSystem>> = null;
  let sending = false;
  let suggestions: string[] = (opts.config.suggestions ?? []).slice(0, 3);
  let suggestionsLoading = false;

  const setAvatarState = (state: 'idle' | 'listening' | 'thinking' | 'speaking') => {
    avatarRuntime?.controller.setState(state);
  };

  void initAvatarSystem({
    config: { ...avatarConfig, primaryColor: primary },
    headerEl,
    chatBodyEl: use3dAvatar ? messagesEl : null,
  }).then((runtime) => {
    avatarRuntime = runtime;
    if (!runtime) return;
    if (sending) runtime.controller.setState('thinking');
    else if (currentAudio) runtime.controller.setState('speaking');
    else if (input.value.trim()) runtime.controller.setState('listening');
    else runtime.controller.setState('idle');
  });

  if (opts.config.welcomeMessage) {
    messages.push({
      role: 'assistant',
      content: opts.config.welcomeMessage,
      messageId: opts.welcomeMessageId,
    });
  }

  function setOpen(open: boolean) {
    wrap.classList.toggle('open', open);
    launcher.setAttribute('aria-expanded', open ? 'true' : 'false');
    launcher.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
    if (open) {
      setTimeout(() => input.focus(), 280);
    }
  }

  function stopSpeech() {
    if (currentAudio) {
      avatarRuntime?.controller.detachAudio();
      currentAudio.pause();
      currentAudio.src = '';
      currentAudio = null;
    }
    speakingMessageId = null;
    ttsLoadingId = null;
    if (!sending && !input.value.trim()) setAvatarState('idle');
    else if (input.value.trim()) setAvatarState('listening');
  }

  async function playSpeech(messageId: string) {
    if (!ttsEnabled || !messageId) return;
    if (speakingMessageId === messageId && currentAudio) {
      stopSpeech();
      render();
      return;
    }
    stopSpeech();
    ttsLoadingId = messageId;
    render();
    try {
      const blob = await opts.api.fetchSpeech(opts.sessionId, messageId, opts.visitorId);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio = audio;
      speakingMessageId = messageId;
      ttsLoadingId = null;
      setAvatarState('speaking');
      avatarRuntime?.controller.attachAudio(audio);
      render();
      audio.addEventListener('ended', () => {
        URL.revokeObjectURL(url);
        if (currentAudio === audio) stopSpeech();
        render();
      });
      audio.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        stopSpeech();
        render();
      });
      await audio.play();
    } catch {
      stopSpeech();
      render();
    }
  }

  function renderSuggestions() {
    suggestionsEl.innerHTML = '';
    const show = !sending && suggestions.length > 0;
    suggestionsEl.classList.toggle('hidden', !show);
    if (!show) return;

    for (const text of suggestions.slice(0, 3)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ap-suggest';
      btn.textContent = text;
      btn.disabled = suggestionsLoading || sending;
      btn.addEventListener('click', () => {
        input.value = text;
        void send();
      });
      suggestionsEl.appendChild(btn);
    }
  }

  async function refreshSuggestions(lastAssistantMessage?: string) {
    suggestionsLoading = true;
    renderSuggestions();
    try {
      const next = await opts.api.fetchSuggestions(opts.sessionId, lastAssistantMessage);
      if (next.length) suggestions = next.slice(0, 3);
    } catch {
      /* keep current */
    } finally {
      suggestionsLoading = false;
      renderSuggestions();
    }
  }

  function render() {
    msgListEl.innerHTML = '';
    for (const m of messages) {
      const div = document.createElement('div');
      div.className = `ap-msg ${m.role === 'user' ? 'user' : 'bot'}`;
      if (m.role === 'assistant') {
        const md = document.createElement('div');
        md.className = 'ap-md';
        md.innerHTML = renderChatMarkdown(m.content);
        div.appendChild(md);
        if (ttsEnabled && m.messageId) {
          const actions = document.createElement('div');
          actions.className = 'ap-msg-actions';
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'ap-tts';
          const isLoading = ttsLoadingId === m.messageId;
          const isPlaying = speakingMessageId === m.messageId;
          if (isLoading) {
            btn.textContent = '…';
            btn.disabled = true;
          } else if (isPlaying) {
            btn.textContent = '⏹ Stop';
            btn.classList.add('playing');
          } else {
            btn.textContent = '🔊 Listen';
          }
          btn.addEventListener('click', () => void playSpeech(m.messageId!));
          actions.appendChild(btn);
          div.appendChild(actions);
        }
      } else {
        div.textContent = m.content;
      }
      if (m.citations?.length) {
        const cite = document.createElement('div');
        cite.className = 'ap-cite';
        cite.textContent = `Sources: ${m.citations.map((c) => c.title).join(', ')}`;
        div.appendChild(cite);
      }
      msgListEl.appendChild(div);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
    sendBtn.disabled = sending;
    renderSuggestions();
  }

  async function send(prefilled?: string) {
    const text = (prefilled ?? input.value).trim();
    if (!text || sending) return;
    input.value = '';
    suggestions = [];
    renderSuggestions();
    messages.push({ role: 'user', content: text });
    render();
    sending = true;
    setAvatarState('thinking');
    const typing = document.createElement('div');
    typing.className = 'ap-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    msgListEl.appendChild(typing);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    try {
      const res = await opts.api.sendMessage(opts.sessionId, text, opts.visitorId);
      messages.push({
        role: 'assistant',
        content: res.content,
        citations: res.citations,
        messageId: res.messageId,
      });
      setAvatarState('idle');
      void refreshSuggestions(res.content);
    } catch {
      messages.push({
        role: 'assistant',
        content: "I'm having trouble right now — please try again in a moment.",
      });
      setAvatarState('idle');
      void refreshSuggestions();
    } finally {
      sending = false;
      render();
    }
  }

  launcher.addEventListener('click', () => {
    const willOpen = !wrap.classList.contains('open');
    setOpen(willOpen);
  });
  closeBtn.addEventListener('click', () => setOpen(false));
  sendBtn.addEventListener('click', () => void send());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  });
  input.addEventListener('input', () => {
    if (sending || currentAudio) return;
    setAvatarState(input.value.trim() ? 'listening' : 'idle');
  });

  render();
  void refreshSuggestions();

  return {
    destroy: () => {
      stopSpeech();
      avatarRuntime?.destroy();
      shadow.host.remove();
    },
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
