import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface EmailTemplate {
  name: string;
  subject: string;
  body: string;
}

const templates: EmailTemplate[] = [
  {
    name: "Follow-up",
    subject: "Following up on your inquiry",
    body: `<p>Hi {{name}},</p>
<p>Thanks for reaching out! I wanted to follow up on your recent inquiry and see if you had any questions.</p>
<p>I'd love to schedule a quick call to discuss how we can help. Would any time this week work for you?</p>
<p>Looking forward to hearing from you!</p>`,
  },
  {
    name: "Meeting Invite",
    subject: "Let's schedule a meeting",
    body: `<p>Hi {{name}},</p>
<p>I'd love to set up a meeting to discuss your needs in more detail and show you how we can help.</p>
<p>Here are a few times that work for me:</p>
<ul>
<li>Monday 10am - 12pm</li>
<li>Wednesday 2pm - 4pm</li>
<li>Friday 10am - 12pm</li>
</ul>
<p>Let me know what works best for you, or feel free to suggest another time.</p>`,
  },
  {
    name: "Thank You",
    subject: "Thank you for your interest!",
    body: `<p>Hi {{name}},</p>
<p>Thank you so much for your interest in our services! We truly appreciate you taking the time to reach out.</p>
<p>We've reviewed your inquiry and would love to explore how we can work together. I'll be in touch shortly with more details.</p>
<p>In the meantime, don't hesitate to reach out if you have any questions.</p>`,
  },
  {
    name: "Special Offer",
    subject: "Exclusive offer just for you",
    body: `<p>Hi {{name}},</p>
<p>As a valued lead, I wanted to share an exclusive offer with you.</p>
<p>For a limited time, we're offering <strong>[describe your offer here]</strong>.</p>
<p>This is a great opportunity to get started. Reply to this email or book a call to learn more!</p>`,
  },
  {
    name: "Re-engagement",
    subject: "We'd love to reconnect",
    body: `<p>Hi {{name}},</p>
<p>It's been a while since we last connected, and I wanted to check in to see how things are going.</p>
<p>We've been working on some exciting new developments that I think could really benefit you. Would you be open to a quick chat to catch up?</p>
<p>Hope to hear from you soon!</p>`,
  },
];

interface EmailTemplatesProps {
  leadName: string;
  onSelect: (subject: string, body: string) => void;
}

const EmailTemplates = ({ leadName, onSelect }: EmailTemplatesProps) => {
  const handleSelect = (template: EmailTemplate) => {
    const body = template.body.replace(/\{\{name\}\}/g, leadName);
    onSelect(template.subject, body);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <FileText className="h-3.5 w-3.5" /> Templates
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {templates.map((t) => (
          <DropdownMenuItem key={t.name} onClick={() => handleSelect(t)}>
            {t.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default EmailTemplates;
