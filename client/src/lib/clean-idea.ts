/**
 * AI ideas sometimes arrive as Markdown list items (`- **"Title"**: …`) or with
 * *emphasis*. Strip that so the chip, and the text it puts in a field, read as plain words.
 */
export function cleanIdea(text: string): string {
  return text
    .trim()
    .replace(/^(?:[-*•]|\d+[.)])\s+/, '')
    .replace(/\*\*|__/g, '')
    .replace(/(^|[\s(])[*_]([^*_\n]+?)[*_](?=[\s.,!?:;)\u2014\u2013-]|$)/g, '$1$2')
    .replace(/^[*_]+|[*_]+$/g, '')
    .replace(/^["'“‘]+|["'”’]+(?=\s*(?::|$))/g, '')
    .trim();
}
