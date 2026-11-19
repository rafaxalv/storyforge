import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { getEnv, type Env } from "../env";
import { log } from "../log";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Template name, for logs (never the content). */
  template: string;
}

export interface MailTransport {
  readonly kind: Env["EMAIL_TRANSPORT"];
  send(message: MailMessage): Promise<void>;
}

/**
 * Development only: prints the message to the terminal with a banner. Deliberately not
 * through the logger, so sign-in links never reach log files. Refused in production by env
 * validation.
 */
export class ConsoleTransport implements MailTransport {
  readonly kind = "console" as const;
  constructor(private readonly out: NodeJS.WritableStream = process.stdout) {}
  async send(m: MailMessage): Promise<void> {
    const line = "=".repeat(72);
    this.out.write(
      `\n${line}\n  DEV EMAIL to ${m.to}: ${m.subject}\n${line}\n${m.text}\n${line}\n\n`,
    );
  }
}

/** Tests and e2e: one JSON file per message in a folder. Refused in production. */
export class OutboxTransport implements MailTransport {
  readonly kind = "outbox" as const;
  constructor(private readonly dir: string) {}
  async send(m: MailMessage): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const name = `${Date.now()}-${crypto.randomUUID()}.json`;
    await writeFile(join(this.dir, name), JSON.stringify(m, null, 2), { mode: 0o600 });
  }
}

/** Production: SMTP via nodemailer. */
export class SmtpTransport implements MailTransport {
  readonly kind = "smtp" as const;
  private readonly transporter: Transporter;
  constructor(
    smtpUrl: string,
    private readonly from: string,
  ) {
    this.transporter = nodemailer.createTransport(smtpUrl);
  }
  async send(m: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: m.to,
      subject: m.subject,
      text: m.text,
      html: m.html,
    });
  }
}

export function createTransport(env: Env = getEnv()): MailTransport {
  switch (env.EMAIL_TRANSPORT) {
    case "outbox":
      return new OutboxTransport(env.MAIL_OUTBOX_DIR);
    case "smtp":
      if (!env.SMTP_URL) throw new Error("SMTP_URL is required for EMAIL_TRANSPORT=smtp");
      return new SmtpTransport(env.SMTP_URL, env.MAIL_FROM);
    case "console":
      return new ConsoleTransport();
  }
}

/** Sends through the configured transport; logs the outcome without addresses or content. */
export async function sendMail(
  m: MailMessage,
  transport: MailTransport = createTransport(),
): Promise<void> {
  const logger = log("mail");
  try {
    await transport.send(m);
    logger.info(
      { event: "mail.sent", transport: transport.kind, template: m.template },
      "email sent",
    );
  } catch (err) {
    logger.error(
      { event: "mail.failed", transport: transport.kind, template: m.template, err },
      "email failed",
    );
    throw err;
  }
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );

export function magicLinkMessage(to: string, url: string): MailMessage {
  const text = `Sign in to storyforge:\n\n${url}\n\nThe link works once and expires in 15 minutes. If you didn't ask for it, ignore this email.`;
  const html = `<p>Sign in to storyforge:</p><p><a href="${escapeHtml(url)}">Sign in</a></p><p>The link works once and expires in 15 minutes. If you didn't ask for it, ignore this email.</p>`;
  return { to, subject: "Your storyforge sign-in link", text, html, template: "magic-link" };
}
