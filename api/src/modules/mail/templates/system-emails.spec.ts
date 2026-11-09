import { escapeHtml, renderEmail } from './email-layout';
import {
  notificationEmail,
  passwordResetEmail,
  plainEmail,
  workspaceInviteEmail,
} from './system-emails';

const opts = {
  logoUrl: 'https://app.example/mako-logo.png',
  appUrl: 'https://app.example',
  appName: 'Mako',
};

describe('branded email layout', () => {
  it('has the logo, a button and the plain link as a fallback', () => {
    const { html } = renderEmail(
      passwordResetEmail({
        resetLink: 'https://app.example/reset?token=abc',
        appName: 'Mako',
      }).content,
      opts,
    );
    expect(html).toContain('src="https://app.example/mako-logo.png"');
    expect(html).toContain('Choose a new password');
    // Button, fallback link, and the fallback link's visible text.
    expect(
      html.match(/https:\/\/app\.example\/reset\?token=abc/g)?.length,
    ).toBe(3);
    expect(html).toContain('#E5A024');
  });

  it('escapes anything people typed', () => {
    const { html } = renderEmail(
      workspaceInviteEmail({
        to: 'a@b.test',
        workspaceName: '<script>alert(1)</script>',
        acceptLink: 'https://app.example/invite?id=1&token=2',
        inviterName: 'Eve "the" <b>',
        appName: 'Mako',
      }).content,
      opts,
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('invite?id=1&amp;token=2');
  });

  it('has a readable plain-text version', () => {
    const { text } = renderEmail(
      passwordResetEmail({
        resetLink: 'https://app.example/r',
        appName: 'Mako',
      }).content,
      opts,
    );
    expect(text).toContain('Reset your password');
    expect(text).toContain('Choose a new password: https://app.example/r');
    expect(text).not.toMatch(/<[a-z]/i);
  });

  it('escapes quotes for attributes', () => {
    expect(escapeHtml(`"'<>&`)).toBe('&quot;&#39;&lt;&gt;&amp;');
  });
});

describe('system emails', () => {
  it('invite subject names who invited them when known', () => {
    expect(
      workspaceInviteEmail({
        to: 'a@b.test',
        workspaceName: 'Bakery',
        acceptLink: 'x',
        inviterName: 'Ana',
        appName: 'Mako',
      }).subject,
    ).toBe('Ana invited you to Bakery on Mako');
    expect(
      workspaceInviteEmail({
        to: 'a@b.test',
        workspaceName: 'Bakery',
        acceptLink: 'x',
        appName: 'Mako',
      }).subject,
    ).toBe("You've been invited to Bakery on Mako");
  });

  it('notification buttons open the page the notification is about', () => {
    const e = notificationEmail({
      title: 'Posts awaiting approval',
      body: 'Two posts need you.',
      link: '/scheduler',
      appUrl: 'https://app.example',
      appName: 'Mako',
    });
    expect(e.content.button).toEqual({
      label: 'Open in Mako',
      url: 'https://app.example/scheduler',
    });
    const noLink = notificationEmail({
      title: 'Hi',
      body: 'x',
      appUrl: 'https://app.example',
      appName: 'Mako',
    });
    expect(noLink.content.button?.url).toBe('https://app.example');
  });

  it('turns blank-line-separated text into paragraphs', () => {
    expect(
      plainEmail({ subject: 'S', text: 'One.\n\nTwo.', appName: 'Mako' })
        .content.paragraphs,
    ).toEqual(['One.', 'Two.']);
  });
});
