/** Where a lead came from, in words people use. Unknown sources are shown as given. */
const LABELS: Record<string, string> = {
  instagram_dm: "Instagram message",
  facebook_dm: "Facebook message",
  x_dm: "X message",
  instagram_comment: "Instagram comment",
  facebook_comment: "Facebook comment",
  linkedin_comment: "LinkedIn comment",
  youtube_comment: "YouTube comment",
  tiktok_comment: "TikTok comment",
  x_reply: "X reply",
  email: "Email",
  whatsapp: "WhatsApp",
  contact_form: "Contact form",
  webhook: "Webhook",
  chatbot: "Website chat",
};

export function leadSourceLabel(source: string | null | undefined): string {
  if (!source) return "Unknown";
  return LABELS[source] ?? source.charAt(0).toUpperCase() + source.slice(1).replace(/_/g, " ");
}

/** Leads that came from a social inbox or comment thread: replies go through the inbox. */
export function isSocialLead(source: string | null | undefined): boolean {
  return Boolean(source && /_(dm|comment|reply)$/.test(source));
}

/** A real address you can email (not empty, not a WhatsApp placeholder). */
export function hasRealEmail(email: string | null | undefined): boolean {
  const e = email?.trim() ?? "";
  return e.includes("@") && !e.endsWith("@inbox.mako");
}
