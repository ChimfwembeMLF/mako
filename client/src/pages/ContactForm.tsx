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

import { API_BASE_URL } from "@/lib/api";

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
  const { tenantId } = useParams<{ tenantId: string }>();
  const [branding, setBranding] = useState<Branding>(defaultBranding);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [aiReply, setAiReply] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/leads/contact-form/${tenantId}/config`);
        if (!res.ok) throw new Error('Failed to load config');
        
        const { brandProfile: bb, chatbotConfig: cb } = await res.json();
        
        let updated = { ...defaultBranding };

        if (bb?.companyName) {
          updated.name = String(bb.companyName);
          updated.tagline = bb.toneOfVoice
            ? `${bb.toneOfVoice} — reach out today`
            : "We'd love to hear from you";
          updated.description = String(bb.description || defaultBranding.description);
        }

        if (cb) {
          if (cb.name) updated.name = cb.name;
          if (cb.welcomeMessage) updated.description = cb.welcomeMessage;
          if (cb.widgetTheme) {
            const theme = cb.widgetTheme;
            if (theme.gradientFrom || theme.gradientTo) {
              updated.gradient = `linear-gradient(${theme.gradientAngle || 135}deg, ${theme.gradientFrom || '#6366f1'}, ${theme.gradientTo || '#a855f7'})`;
            }
            if (theme.avatarUrl) {
              (updated as any).avatarUrl = theme.avatarUrl;
            }
          }
        }
        
        setBranding(updated);
      } catch {
        /* use default branding */
      }
    })();
  }, [tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || (!email.trim() && !phone.trim()) || !tenantId) {
      toast({ title: "Required", description: "Please provide a name and either an email or phone number.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/leads/contact-form/${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, message })
      });
      
      if (!res.ok) {
        throw new Error("Failed to submit message");
      }
      
      const result = await res.json();
      if (result?.error) throw new Error(result.error);

      setSubmitted(true);
      if (result?.ai_reply) setAiReply(result.ai_reply);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!tenantId) {
    return (
      <div className="w-full">
        <Card className="w-full">
          <CardContent className="p-6 text-center text-muted-foreground">
            Invalid contact form link.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="w-full">
        <Card className="w-full overflow-hidden">
          <div 
            className={`p-6 text-center text-white ${branding.gradient?.startsWith('linear-gradient') ? '' : `bg-gradient-to-r ${branding.gradient}`}`}
            style={branding.gradient?.startsWith('linear-gradient') ? { background: branding.gradient } : undefined}
          >
            {(branding as any).avatarUrl ? (
              <img src={(branding as any).avatarUrl} alt="Avatar" className="h-12 w-12 mx-auto mb-3 rounded-full object-cover shadow-sm bg-white" />
            ) : (
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3" />
            )}
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
    );
  }

  return (
    <div className="w-full">
      <Card className="w-full shadow-card overflow-hidden">
      <div 
        className={`p-6 text-center text-white ${branding.gradient?.startsWith('linear-gradient') ? '' : `bg-gradient-to-r ${branding.gradient}`}`}
        style={branding.gradient?.startsWith('linear-gradient') ? { background: branding.gradient } : undefined}
      >
        {(branding as any).avatarUrl ? (
          <img src={(branding as any).avatarUrl} alt="Avatar" className="h-10 w-10 mx-auto mb-3 rounded-full object-cover shadow-sm bg-white" />
        ) : (
          <Send className="h-10 w-10 mx-auto mb-3" />
        )}
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
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" maxLength={255} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" maxLength={20} />
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
          <Button 
            type="submit" 
            disabled={submitting} 
            className={`w-full text-white border-0 hover:opacity-90 ${branding.gradient?.startsWith('linear-gradient') ? '' : `bg-gradient-to-r ${branding.gradient}`}`}
            style={branding.gradient?.startsWith('linear-gradient') ? { background: branding.gradient } : undefined}
          >
            <Send className="mr-2 h-4 w-4" />
            {submitting ? "Sending..." : "Send Message"}
          </Button>
        </form>
      </CardContent>
      </Card>
    </div>
  );
};

export default ContactForm;
