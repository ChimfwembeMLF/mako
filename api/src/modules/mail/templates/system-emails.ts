import { EmailContent } from './email-layout';

/**
 * Every email Mako sends on its own behalf, in one place. Each returns a subject and
 * the content for the branded layout. Emails people write to their leads are separate.
 */
export type SystemEmail = { subject: string; content: EmailContent };

export function passwordResetEmail(params: {
  resetLink: string;
  appName: string;
}): SystemEmail {
  return {
    subject: `Reset your ${params.appName} password`,
    content: {
      preheader: 'Use this link within the hour to choose a new password.',
      heading: 'Reset your password',
      paragraphs: [
        `Someone asked to reset the password for your ${params.appName} account. If that was you, choose a new one below.`,
      ],
      button: { label: 'Choose a new password', url: params.resetLink },
      note: "This link works once and expires in 1 hour. If you didn't ask for it, you can ignore this email; your password won't change.",
      footer: `You're getting this because a password reset was requested for your ${params.appName} account.`,
    },
  };
}

export function workspaceInviteEmail(params: {
  to: string;
  workspaceName: string;
  acceptLink: string;
  hasAccount?: boolean;
  inviterName?: string | null;
  appName: string;
}): SystemEmail {
  const who = params.inviterName?.trim();
  const subject = who
    ? `${who} invited you to ${params.workspaceName} on ${params.appName}`
    : `You've been invited to ${params.workspaceName} on ${params.appName}`;
  return {
    subject,
    content: {
      preheader: `Join ${params.workspaceName} to plan, publish and reply together.`,
      heading: `Join ${params.workspaceName}`,
      paragraphs: [
        who
          ? `${who} invited you to work together in ${params.workspaceName} on ${params.appName}.`
          : `You've been invited to work together in ${params.workspaceName} on ${params.appName}.`,
        params.hasAccount
          ? `Sign in with ${params.to} to accept.`
          : `Create your ${params.appName} account with ${params.to}, then accept. It only takes a minute.`,
      ],
      button: { label: 'Review invitation', url: params.acceptLink },
      note: "This invitation expires in 7 days. If you weren't expecting it, you can ignore this email.",
      footer: `You're getting this because someone invited ${params.to} to ${params.workspaceName}.`,
    },
  };
}

export function notificationEmail(params: {
  title: string;
  body: string;
  /** Path in the app (e.g. "/scheduler") or a full URL. */
  link?: string | null;
  appUrl: string;
  appName: string;
}): SystemEmail {
  const url = params.link
    ? /^https?:\/\//i.test(params.link)
      ? params.link
      : `${params.appUrl}${params.link.startsWith('/') ? '' : '/'}${
          params.link
        }`
    : params.appUrl;
  return {
    subject: params.title,
    content: {
      preheader: params.body.slice(0, 90),
      heading: params.title,
      paragraphs: params.body
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean),
      button: {
        label: params.link ? 'Open in Mako' : `Go to ${params.appName}`,
        url,
      },
      footer: `You're getting this because email notifications are on. Turn them off in ${params.appName} under Settings → Notifications.`,
    },
  };
}

/** A plain message (from the backoffice or other admin tools) in the branded layout. */
export function plainEmail(params: {
  subject: string;
  text: string;
  appName: string;
}): SystemEmail {
  return {
    subject: params.subject,
    content: {
      preheader: params.text.slice(0, 90),
      heading: params.subject,
      paragraphs: params.text
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean),
      footer: `Sent by ${params.appName}.`,
    },
  };
}
