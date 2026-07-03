import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Send, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { brandProfilesApi } from "@/lib/api";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";

interface Branding {
  name: string;
  tagline: string;
  gradient: string;
  bgClass: string;
  description: string;
}

const defaultBranding: Branding = {
  name: "Get in Touch",
  tagline: "We'd love to hear from you",
  gradient: "from-primary to-primary/80",
  bgClass: "bg-primary/5",
  description: "Send us a message and we'll get back to you as soon as possible.",
};

const ContactForm = () => {
  const { userId } = useParams<{ userId: string }>();
  const [branding, setBranding] = useState<Branding>(defaultBranding);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [aiReply, setAiReply] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const all = await brandProfilesApi.findAll();
        const list = Array.isArray(all) ? all : [];
        const bb = list.find((p: Record<string, unknown>) => p.userId === userId);
        if (bb?.companyName) {
          setBranding({
            name: String(bb.companyName),
            tagline: bb.toneOfVoice
              ? `${bb.toneOfVoice} — reach out today`
              : "We'd love to hear from you",
            gradient: "from-primary to-primary/80",
            bgClass: "bg-primary/5",
            description: String(bb.description || defaultBranding.description),
          });
        }
      } catch {
        /* use default branding */
      }
    })();
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !userId) return;

    setSubmitting(true);
    try {
      const { data, error } = await invokeEdgeFunction("lead-webhook", {
        body: { name, email, message, source: "contact_form", user_id: userId },
      });
      if (error) throw error;
      const result = data as { error?: string; ai_reply?: string } | null;
      if (result?.error) throw new Error(result.error);

      setSubmitted(true);
      if (result?.ai_reply) setAiReply(result.ai_reply);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-4">
          <AppBreadcrumbs />
          <Card className="w-full">
            <CardContent className="p-6 text-center text-muted-foreground">
              Invalid contact form link.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-4">
          <AppBreadcrumbs />
          <Card className="w-full overflow-hidden">
            <div className={`bg-gradient-to-r ${branding.gradient} p-6 text-center text-white`}>
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3" />
              <h2 className="text-xl font-bold">Thank you!</h2>
              <p className="text-sm opacity-90 mt-1">We've received your message</p>
            </div>
            <CardContent className="p-6 space-y-4">
              <p className="text-muted-foreground text-sm text-center">
                We'll get back to you as soon as possible.
              </p>
              {aiReply && (
                <div className={`${branding.bgClass} border rounded-lg p-4 text-left`}>
                  <p className="text-xs text-muted-foreground mb-1">Quick response:</p>
                  <p className="text-sm">{aiReply}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4">
        <AppBreadcrumbs />
        <Card className="w-full shadow-card overflow-hidden">
        <div className={`bg-gradient-to-r ${branding.gradient} p-6 text-center text-white`}>
          <Send className="h-10 w-10 mx-auto mb-3" />
          <h1 className="text-xl font-bold">{branding.name}</h1>
          <p className="text-sm opacity-90 mt-1">{branding.tagline}</p>
        </div>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground mb-4">{branding.description}</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required maxLength={255} />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="How can we help you?"
                rows={4}
                maxLength={1000}
              />
            </div>
            <Button type="submit" disabled={submitting} className={`w-full bg-gradient-to-r ${branding.gradient} text-white border-0 hover:opacity-90`}>
              <Send className="mr-2 h-4 w-4" />
              {submitting ? "Sending..." : "Send Message"}
            </Button>
          </form>
        </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ContactForm;
