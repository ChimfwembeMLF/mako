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
  config: { name: string; welcomeMessage?: string; theme: Record<string, unknown>; ttsEnabled?: boolean };
  sessionId: string;
  visitorId: string;
  welcomeMessageId?: string;
  widgetBase: string;
  host: HTMLElement;
  position?: string;
};

const STYLES = `
:host { all: initial; font-family: system-ui, -apple-system, sans-serif; }
.ap-wrap { position: fixed; z-index: 2147483000; }
.ap-wrap.br { bottom: 20px; right: 20px; }
.ap-wrap.bl { bottom: 20px; left: 20px; }
.ap-launcher {
  width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer;
  background: var(--ap-gradient, var(--ap-primary, #6366f1)); color: #fff; box-shadow: 0 4px 24px rgba(0,0,0,.18);
  font-size: 24px; display: flex; align-items: center; justify-content: center;
}
.ap-panel {
  display: none; flex-direction: column; width: 380px; max-width: calc(100vw - 32px);
  height: 520px; max-height: calc(100vh - 100px); background: #fff; border-radius: 16px;
  box-shadow: 0 8px 40px rgba(0,0,0,.15); overflow: hidden; margin-bottom: 12px;
}
.ap-panel.open { display: flex; }
.ap-header {
  padding: 12px 14px; background: var(--ap-gradient, var(--ap-primary, #6366f1)); color: #fff;
  font-weight: 600; font-size: 15px; display: flex; align-items: center; gap: 10px;
  flex-shrink: 0;
}
.ap-header-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap-header img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; background: rgba(255,255,255,.2); flex-shrink: 0; }
.ap-header img.ap-header-logo { width: 28px; height: 28px; margin-right: -4px; }
.ap-avatar-inline {
  display: flex; justify-content: flex-start; padding: 2px 0 6px; flex-shrink: 0;
}
.ap-avatar-inline-slot {
  width: 56px; height: 56px; border-radius: 50%; overflow: hidden;
  background: #f1f5f9; flex-shrink: 0;
}
.ap-avatar-3d-slot { flex-shrink: 0; }
.ap-ar-btn {
  flex-shrink: 0; border: 1px solid rgba(255,255,255,.35); background: rgba(255,255,255,.15);
  color: #fff; font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 8px;
  cursor: pointer;
}
.ap-ar-btn:hover { background: rgba(255,255,255,.28); }
.ap-launcher img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.ap-messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.ap-msg-list { display: flex; flex-direction: column; gap: 8px; }
.ap-msg { max-width: 85%; padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.45; }
.ap-msg.user { align-self: flex-end; background: var(--ap-gradient, var(--ap-primary, #6366f1)); color: #fff; border-bottom-right-radius: 4px; }
.ap-msg.bot { align-self: flex-start; background: #f1f5f9; color: #0f172a; border-bottom-left-radius: 4px; }
.ap-md { word-break: break-word; }
.ap-md p { margin: 0 0 0.5em; }
.ap-md p:last-child { margin-bottom: 0; }
.ap-md ul, .ap-md ol { margin: 0.35em 0; padding-left: 1.25em; }
.ap-md li { margin: 0.15em 0; }
.ap-md h1, .ap-md h2, .ap-md h3, .ap-md h4 { margin: 0.5em 0 0.35em; font-size: 1em; font-weight: 600; }
.ap-md h1 { font-size: 1.1em; }
.ap-md code { background: rgba(15,23,42,.08); padding: 0.1em 0.35em; border-radius: 4px; font-size: 0.9em; }
.ap-md pre { background: rgba(15,23,42,.08); padding: 8px 10px; border-radius: 8px; overflow-x: auto; margin: 0.5em 0; }
.ap-md pre code { background: none; padding: 0; }
.ap-md blockquote { margin: 0.5em 0; padding-left: 0.75em; border-left: 3px solid rgba(15,23,42,.15); opacity: 0.9; }
.ap-md a { color: var(--ap-primary, #6366f1); text-decoration: underline; }
.ap-cite { font-size: 10px; opacity: .75; margin-top: 4px; }
.ap-msg-actions { display: flex; gap: 6px; margin-top: 6px; }
.ap-tts {
  border: 1px solid rgba(15,23,42,.12); background: #fff; cursor: pointer;
  padding: 4px 10px; font-size: 12px; font-weight: 500; color: #334155;
  border-radius: 999px; display: inline-flex; align-items: center; gap: 4px;
}
.ap-tts:hover { background: #f8fafc; color: #0f172a; border-color: rgba(15,23,42,.2); }
.ap-tts:disabled { opacity: 0.5; cursor: not-allowed; }
.ap-tts.playing { color: var(--ap-primary, #6366f1); border-color: var(--ap-primary, #6366f1); }
.ap-input-row { display: flex; gap: 8px; padding: 10px; border-top: 1px solid #e2e8f0; }
.ap-input {
  flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 12px;
  font-size: 14px; resize: none; font-family: inherit; min-height: 40px;
}
.ap-send {
  border: none; border-radius: 10px; padding: 0 14px; background: var(--ap-gradient, var(--ap-primary, #6366f1));
  color: #fff; cursor: pointer; font-weight: 600;
}
.ap-typing { display: flex; gap: 4px; padding: 10px 14px; }
.ap-typing span { width: 6px; height: 6px; border-radius: 50%; background: #94a3b8; animation: ap-bounce 1s infinite; }
.ap-typing span:nth-child(2) { animation-delay: .15s; }
.ap-typing span:nth-child(3) { animation-delay: .3s; }
@keyframes ap-bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-4px)} }
@media (max-width: 480px) {
  .ap-panel { width: 100vw; height: 70vh; max-width: 100vw; border-radius: 16px 16px 0 0; }
  .ap-wrap.br, .ap-wrap.bl { left: 0; right: 0; bottom: 0; }
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
    <div class="ap-header">${headerAvatar}<span class="ap-header-title">${escapeHtml(opts.config.name)}</span></div>
    <div class="ap-messages" role="log" aria-live="polite"><div class="ap-msg-list"></div></div>
    <div class="ap-input-row">
      <textarea class="ap-input" rows="1" placeholder="Type a message…" aria-label="Message"></textarea>
      <button type="button" class="ap-send">Send</button>
    </div>
  `;
  wrap.appendChild(panel);

  const headerEl = panel.querySelector('.ap-header')!;
  const messagesEl = panel.querySelector('.ap-messages')!;
  const msgListEl = panel.querySelector('.ap-msg-list')!;

  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'ap-launcher';
  launcher.setAttribute('aria-label', 'Open chat');
  if (avatarUrl) {
    const img = document.createElement('img');
    img.src = avatarUrl;
    img.alt = '';
    launcher.appendChild(img);
  } else {
    launcher.textContent = '💬';
  }
  wrap.appendChild(launcher);

  const input = panel.querySelector('.ap-input') as HTMLTextAreaElement;
  const sendBtn = panel.querySelector('.ap-send') as HTMLButtonElement;

  const messages: WidgetMessage[] = [];
  const ttsEnabled = opts.config.ttsEnabled ?? false;
  let currentAudio: HTMLAudioElement | null = null;
  let speakingMessageId: string | null = null;
  let ttsLoadingId: string | null = null;
  let avatarRuntime: Awaited<ReturnType<typeof initAvatarSystem>> = null;
  let sending = false;

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
          btn.setAttribute('aria-label', isPlaying ? 'Stop speech' : 'Listen to reply');
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
  }

  async function send() {
    const text = input.value.trim();
    if (!text || sending) return;
    input.value = '';
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
    } catch {
      messages.push({
        role: 'assistant',
        content: "I'm having trouble right now — please try again in a moment.",
      });
      setAvatarState('idle');
    } finally {
      sending = false;
      render();
    }
  }

  launcher.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) input.focus();
  });
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
  input.addEventListener('focus', () => {
    if (!sending && !currentAudio) setAvatarState(input.value.trim() ? 'listening' : 'idle');
  });
  input.addEventListener('blur', () => {
    if (!sending && !currentAudio && !input.value.trim()) setAvatarState('idle');
  });

  render();

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
