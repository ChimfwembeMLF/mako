/**
 * Mako's branded email layout. Table-based with inline styles, because Gmail, Outlook
 * and phone mail apps ignore most <style> blocks and modern CSS.
 */

export const EMAIL_BRAND = {
  /** The orange in the Mako logo, also the app's accent. */
  accent: '#E5A024',
  /** Text on the accent: dark, like the app's buttons, for contrast. */
  onAccent: '#0e0f0c',
  ink: '#0e0f0c',
  body: '#3d3f3a',
  muted: '#77796f',
  canvas: '#eef0eb',
  card: '#ffffff',
  border: '#e2e5de',
  deepPurple: '#220044',
} as const;

export type EmailContent = {
  /** Shown in the inbox list after the subject; keep it under ~90 characters. */
  preheader: string;
  heading: string;
  /** Paragraphs of plain text. They are escaped, so no HTML here. */
  paragraphs: string[];
  button?: { label: string; url: string };
  /** Small print under the button, e.g. when a link expires. */
  note?: string;
  /** Why they got this email. */
  footer: string;
};

export type RenderedEmail = { html: string; text: string };

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function renderEmail(
  content: EmailContent,
  options: { logoUrl: string; appName?: string; appUrl: string },
): RenderedEmail {
  const b = EMAIL_BRAND;
  const appName = options.appName ?? 'Mako';
  const p = (text: string) =>
    `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:24px;color:${
      b.body
    };">${escapeHtml(text)}</p>`;

  const button = content.button
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
        <tr>
          <td style="border-radius:999px;background:${b.accent};" bgcolor="${
        b.accent
      }">
            <a href="${escapeHtml(content.button.url)}" target="_blank"
               style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:600;line-height:20px;color:${
        b.onAccent
      };text-decoration:none;border-radius:999px;">
              ${escapeHtml(content.button.label)}
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 4px;font-family:${FONT};font-size:13px;line-height:20px;color:${
        b.muted
      };">If the button doesn't work, copy this link into your browser:</p>
      <p style="margin:0 0 20px;font-family:${FONT};font-size:13px;line-height:20px;word-break:break-all;"><a href="${escapeHtml(
        content.button.url,
      )}" style="color:${b.deepPurple};">${escapeHtml(
        content.button.url,
      )}</a></p>`
    : '';

  const note = content.note
    ? `<p style="margin:0;padding:12px 16px;border-radius:12px;background:${
        b.canvas
      };font-family:${FONT};font-size:14px;line-height:21px;color:${
        b.body
      };">${escapeHtml(content.note)}</p>`
    : '';

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(content.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${b.canvas};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(
    content.preheader,
  )}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${
    b.canvas
  };" bgcolor="${b.canvas}">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td style="padding:0 8px 20px;">
            <a href="${escapeHtml(
              options.appUrl,
            )}" target="_blank" style="text-decoration:none;">
              <img src="${escapeHtml(
                options.logoUrl,
              )}" width="56" height="56" alt="${escapeHtml(
    appName,
  )}" style="display:block;border:0;width:56px;height:56px;">
            </a>
          </td>
        </tr>
        <tr>
          <td style="background:${b.card};border:1px solid ${
    b.border
  };border-radius:20px;" bgcolor="${b.card}">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              
              <tr>
                <td style="padding:32px 32px 28px;">
                  <div style="width:40px;height:4px;margin:0 0 20px;border-radius:4px;background:${
                    b.accent
                  };font-size:0;line-height:0;">&nbsp;</div>
                  <h1 style="margin:0 0 16px;font-family:${FONT};font-size:24px;line-height:31px;font-weight:700;color:${
    b.ink
  };">${escapeHtml(content.heading)}</h1>
                  ${content.paragraphs.map(p).join('\n                  ')}
                  ${button}
                  ${note}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 8px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${
    b.muted
  };">
            ${escapeHtml(content.footer)}<br>
            <a href="${escapeHtml(options.appUrl)}" style="color:${
    b.muted
  };">${escapeHtml(appName)}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = [
    content.heading,
    '',
    ...content.paragraphs.flatMap((t) => [t, '']),
    ...(content.button
      ? [`${content.button.label}: ${content.button.url}`, '']
      : []),
    ...(content.note ? [content.note, ''] : []),
    '—',
    content.footer,
    `${appName} · ${options.appUrl}`,
  ].join('\n');

  return { html, text };
}
