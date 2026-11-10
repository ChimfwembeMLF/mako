/** Short replies that say nothing new about the lead ("ok", "thanks", "👍"). */
const SMALL_TALK =
  /^(ok(ay)?|k|yes|no|yep|nope|sure|thanks?( you)?|thank you|thx|ty|cool|great|nice|hi|hello|hey|bye|good( morning| afternoon| evening)?|alright|noted|👍|🙏|❤️|😊)[\s.!?]*$/i;

/** How long after a classification a lead is left alone, unless something long comes in. */
const RECLASSIFY_AFTER_MS = 6 * 3600_000;

/**
 * Whether a new message is worth an AI call to (re)classify the lead. A lead's first real
 * message always is; after that, only a substantial message once the last label is stale.
 */
export function worthClassifying(
  message: string,
  lead: { classification?: string },
  lastClassifiedAt?: number,
): boolean {
  const text = message.trim();
  if (!text || SMALL_TALK.test(text) || /^📎|^📷|^📹|^🎵/.test(text)) return false;
  const words = text.split(/\s+/).length;
  if (!lead.classification || lead.classification === 'inbound') return words >= 3;
  if (words < 8) return false;
  return !lastClassifiedAt || Date.now() - lastClassifiedAt > RECLASSIFY_AFTER_MS;
}
