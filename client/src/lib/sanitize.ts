import DOMPurify from "dompurify";

export const sanitizeHtml = (html: string): string =>
  DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'u', 'p', 'br', 'ul', 'ol', 'li', 'a',
      'h2', 'h3', 'blockquote', 'span',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
