import { useMemo, useState } from "react";
import { BookOpen, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ChatbotIntegrationExamplesProps = {
  apiBase: string;
  apiKey?: string | null;
  widgetOrigin?: string;
  embedSnippet: string;
};

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
      <pre className="text-[11px] leading-relaxed bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">
        {code}
      </pre>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          void navigator.clipboard.writeText(code);
          toast.success("Copied to clipboard");
        }}
      >
        <Copy className="h-4 w-4 mr-2" />
        Copy
      </Button>
    </div>
  );
}

export function ChatbotIntegrationExamples({
  apiBase,
  apiKey,
  widgetOrigin,
  embedSnippet,
}: ChatbotIntegrationExamplesProps) {
  const [tab, setTab] = useState("embed");
  const key = apiKey ?? "pk_live_YOUR_KEY";
  const widgetHost = widgetOrigin ?? window.location.origin;
  const openapiUrl = `${apiBase.replace(/\/$/, "")}/docs/chatbot-widget.openapi.yaml`;
  const swaggerUrl = `${apiBase.replace(/\/$/, "")}/documentation`;

  const curlConfig = useMemo(
    () => `curl -s "${apiBase}/api/v1/widget/config" \\
  -H "Authorization: Bearer ${key}"`,
    [apiBase, key],
  );

  const curlSession = useMemo(
    () => `curl -s -X POST "${apiBase}/api/v1/widget/sessions" \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"visitorId":"visitor-123"}'`,
    [apiBase, key],
  );

  const curlMessage = useMemo(
    () => `curl -s -X POST "${apiBase}/api/v1/widget/sessions/SESSION_ID/messages" \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -H "X-Visitor-Id: visitor-123" \\
  -d '{"content":"What are your business hours?"}'`,
    [apiBase, key],
  );

  const jsExample = useMemo(
    () => `const API_BASE = '${apiBase}';
const API_KEY = '${key}';

async function widgetFetch(path, options = {}) {
  const res = await fetch(\`\${API_BASE}\${path}\`, {
    ...options,
    headers: {
      Authorization: \`Bearer \${API_KEY}\`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const config = await widgetFetch('/api/v1/widget/config');
const { sessionId, visitorId } = await widgetFetch('/api/v1/widget/sessions', {
  method: 'POST',
  body: JSON.stringify({ visitorId: 'visitor-' + crypto.randomUUID() }),
});

const reply = await widgetFetch(\`/api/v1/widget/sessions/\${sessionId}/messages\`, {
  method: 'POST',
  headers: { 'X-Visitor-Id': visitorId },
  body: JSON.stringify({ content: 'Hello!' }),
});
console.log(reply.content);`,
    [apiBase, key],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Integration examples
        </CardTitle>
        <CardDescription>
          Embed script, REST examples, and OpenAPI spec for custom integrations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={openapiUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              OpenAPI spec
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={swaggerUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Swagger UI
            </a>
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="embed">Embed</TabsTrigger>
            <TabsTrigger value="curl">cURL</TabsTrigger>
            <TabsTrigger value="javascript">JavaScript</TabsTrigger>
          </TabsList>

          <TabsContent value="embed" className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Loader hosted at <code className="text-foreground">{widgetHost}/widget/v1/loader.js</code>
            </p>
            <CodeBlock code={embedSnippet} label="HTML — add before &lt;/body&gt;" />
          </TabsContent>

          <TabsContent value="curl" className="mt-4 space-y-4">
            <CodeBlock code={curlConfig} label="1. Get widget config" />
            <CodeBlock code={curlSession} label="2. Create session" />
            <CodeBlock code={curlMessage} label="3. Send message" />
          </TabsContent>

          <TabsContent value="javascript" className="mt-4">
            <CodeBlock code={jsExample} label="Full chat flow (browser or Node 18+)" />
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground">
          Replace <code className="text-foreground">SESSION_ID</code> and use your API key from above.
          See <code className="text-foreground">autopilot-api/docs/CHATBOT_WIDGET_INTEGRATION.md</code> for
          TTS, errors, and security notes.
        </p>
      </CardContent>
    </Card>
  );
}
