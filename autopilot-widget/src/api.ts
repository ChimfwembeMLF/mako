export type WidgetConfig = {
  name: string;
  welcomeMessage?: string;
  theme: Record<string, unknown>;
  ttsEnabled?: boolean;
};

export type ChatCitation = {
  documentId: string;
  title: string;
  excerpt: string;
};

export class WidgetApi {
  constructor(
    private readonly apiBase: string,
    private readonly apiKey: string,
  ) {}

  private headers(visitorId?: string): HeadersInit {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
    if (visitorId) h['X-Visitor-Id'] = visitorId;
    return h;
  }

  async getConfig(): Promise<WidgetConfig> {
    const res = await fetch(`${this.apiBase}/api/v1/widget/config`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error('Failed to load widget config');
    return res.json();
  }

  async createSession(
    visitorId?: string,
  ): Promise<{ sessionId: string; visitorId: string; welcomeMessageId?: string }> {
    const res = await fetch(`${this.apiBase}/api/v1/widget/sessions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ visitorId }),
    });
    if (!res.ok) throw new Error('Failed to create session');
    return res.json();
  }

  async sendMessage(
    sessionId: string,
    content: string,
    visitorId: string,
  ): Promise<{ messageId: string; content: string; citations: ChatCitation[] }> {
    const res = await fetch(`${this.apiBase}/api/v1/widget/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: this.headers(visitorId),
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error('Failed to send message');
    return res.json();
  }

  async fetchSpeech(
    sessionId: string,
    messageId: string,
    visitorId: string,
  ): Promise<Blob> {
    const res = await fetch(
      `${this.apiBase}/api/v1/widget/sessions/${sessionId}/messages/${messageId}/speech`,
      {
        method: 'POST',
        headers: this.headers(visitorId),
      },
    );
    if (!res.ok) throw new Error('Failed to load speech');
    return res.blob();
  }
}
