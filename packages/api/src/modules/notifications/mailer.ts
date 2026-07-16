import type { EmailMessage } from './notifications.js';

export interface Mailer {
  send(msg: EmailMessage): Promise<void>;
}

// SMTP transport when SMTP_HOST is configured; otherwise a console transport so
// self-hosters see notifications in the logs without any mail setup.
let cached: Mailer | null = null;

export function getMailer(): Mailer {
  if (cached) return cached;

  if (process.env.SMTP_HOST) {
    cached = {
      async send(msg) {
        // Lazy import so nodemailer is only loaded when actually configured.
        const nodemailer = await import('nodemailer');
        const transport = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT ?? 587),
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
        });
        await transport.sendMail({
          from: process.env.MAIL_FROM ?? 'hesab@localhost',
          to: msg.to,
          subject: msg.subject,
          text: msg.body,
        });
      },
    };
  } else {
    cached = {
      async send(msg) {
        // eslint-disable-next-line no-console
        console.log(`[mail] to=${msg.to} :: ${msg.subject} :: ${msg.body}`);
      },
    };
  }
  return cached;
}
