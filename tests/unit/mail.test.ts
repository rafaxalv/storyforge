import { mkdtemp, readdir, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  ConsoleTransport,
  OutboxTransport,
  SmtpTransport,
  magicLinkMessage,
  sendMail,
  type MailTransport,
} from "@/server/auth/mail";
import { captureLogs } from "../helpers";

const LINK =
  "http://localhost:3000/api/auth/magic-link/verify?token=SECRET_TOKEN_123&callbackURL=%2F";

describe("mail", () => {
  it("builds the magic-link message with the link in text and escaped in HTML", () => {
    const m = magicLinkMessage("a@b.co", `${LINK}&x="<y>"`);
    expect(m.text).toContain(LINK);
    expect(m.html).toContain("&quot;&lt;y&gt;&quot;");
    expect(m.html).not.toContain('"<y>"');
    expect(m.template).toBe("magic-link");
  });

  it("console transport prints to its stream, not to the logger", async () => {
    const { lines } = captureLogs();
    let out = "";
    const stream = new Writable({
      write(chunk: Buffer, _e, cb) {
        out += chunk.toString();
        cb();
      },
    });
    await sendMail(magicLinkMessage("a@b.co", LINK), new ConsoleTransport(stream));
    expect(out).toContain("DEV EMAIL to a@b.co");
    expect(out).toContain(LINK);
    expect(JSON.stringify(lines)).not.toContain("SECRET_TOKEN_123");
    expect(JSON.stringify(lines)).not.toContain("a@b.co");
    expect(lines.find((l) => l.event === "mail.sent")).toMatchObject({
      transport: "console",
      template: "magic-link",
    });
  });

  it("outbox transport writes one private JSON file per message", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sf-mail-"));
    await new OutboxTransport(dir).send(magicLinkMessage("a@b.co", LINK));
    const files = await readdir(dir);
    expect(files).toHaveLength(1);
    const file = join(dir, files[0] ?? "");
    expect(JSON.parse(await readFile(file, "utf8"))).toMatchObject({
      to: "a@b.co",
      template: "magic-link",
    });
    expect((await stat(file)).mode & 0o777).toBe(0o600);
  });

  it("smtp transport hands the message to nodemailer", async () => {
    const t = new SmtpTransport("smtp://localhost:1", "storyforge <no-reply@example.com>");
    const sent: unknown[] = [];
    // Replace the real connection with a capture; the SMTP protocol itself is covered by e2e.
    Object.assign(t, { transporter: { sendMail: async (m: unknown) => void sent.push(m) } });
    await t.send(magicLinkMessage("a@b.co", LINK));
    expect(sent[0]).toMatchObject({ from: "storyforge <no-reply@example.com>", to: "a@b.co" });
  });

  it("logs mail.failed and rethrows when a transport fails", async () => {
    const { lines } = captureLogs();
    const broken: MailTransport = {
      kind: "smtp",
      send: async () => {
        throw new Error("connection refused");
      },
    };
    await expect(sendMail(magicLinkMessage("a@b.co", LINK), broken)).rejects.toThrow(
      "connection refused",
    );
    expect(lines.find((l) => l.event === "mail.failed")).toMatchObject({
      level: "error",
      transport: "smtp",
    });
    expect(JSON.stringify(lines)).not.toContain("SECRET_TOKEN_123");
  });
});
