import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import * as schema from "../db/schema";
import { baseUrl, getEnv, type Env } from "../env";
import { enqueue } from "../jobs/queue";
import { QUEUES } from "../jobs/names";
import { CLIENT_IP_HEADER } from "../http";
import { log } from "../log";
import { processSingleton } from "../singleton";
import { emailHash } from "./hash";
import { magicLinkMessage, sendMail } from "./mail";

export const MAGIC_LINK_TTL_S = 15 * 60;
const DAY_S = 24 * 60 * 60;

export type Role = "user" | "admin";

/** The role an email should have under ADMIN_EMAILS (case-insensitive). */
export function roleFor(email: string, adminEmails: readonly string[]): Role {
  return adminEmails.includes(email.trim().toLowerCase()) ? "admin" : "user";
}

/** Initial display name: the local part of the email, at most 80 characters. */
export function defaultName(email: string): string {
  return (email.split("@")[0] || "Author").slice(0, 80);
}

function methodFromPath(path: string | undefined): string {
  if (!path) return "unknown";
  if (path.startsWith("/magic-link")) return "magic-link";
  if (path.startsWith("/callback/")) return path.slice("/callback/".length);
  return path;
}

/** Better Auth options for storyforge. Tests build their own instance from these. */
export function authOptions(env: Env = getEnv()) {
  const logger = log("auth");
  return {
    appName: "storyforge",
    baseURL: baseUrl(env),
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [baseUrl(env)],
    telemetry: { enabled: false },
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    session: {
      expiresIn: 30 * DAY_S,
      updateAge: DAY_S,
      freshAge: DAY_S,
    },
    user: {
      additionalFields: {
        role: { type: "string", required: true, defaultValue: "user", input: false },
        monthlyTokenCap: { type: "number", required: false, input: false },
      },
      deleteUser: {
        enabled: true,
        afterDelete: async (user) => {
          // Better Auth already removed user, sessions and accounts. Unused sign-in links
          // are keyed by email, so they go now; the job only ever sees the user id.
          await getDb()
            .delete(schema.verification)
            .where(eq(schema.verification.identifier, user.email));
          const jobId = await enqueue(QUEUES.accountPurge, { userId: user.id });
          log("account").info(
            { event: "account.deleted", userId: user.id, jobId },
            "account deleted",
          );
        },
      },
    },
    account: {
      accountLinking: { enabled: true, trustedProviders: ["google"] },
    },
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
        : {},
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: { "/sign-in/magic-link": { window: 600, max: 5 } },
    },
    advanced: {
      cookiePrefix: "storyforge",
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
    },
    logger: {
      level: env.LOG_LEVEL === "debug" || env.LOG_LEVEL === "trace" ? "debug" : "warn",
      // Better Auth's own messages, routed into pino so they carry request ids. Extra
      // arguments are dropped except errors: they can contain tokens or addresses.
      log: (level, message, ...args) => {
        const err = args.find((a): a is Error => a instanceof Error);
        logger[level]({ event: "better_auth", ...(err ? { err } : {}) }, message);
      },
    },
    databaseHooks: {
      user: {
        create: {
          // Magic-link sign-ups arrive without a name; start with the part of the address
          // before "@" so the app has something to show. The author can change it.
          before: async (user) => ({
            data: { ...user, name: user.name.trim() || defaultName(user.email) },
          }),
          after: async (user) => {
            logger.info({ event: "auth.user.created", userId: user.id }, "account created");
          },
        },
      },
      session: {
        create: {
          after: async (session, ctx) => {
            const db = getDb();
            const [row] = await db
              .select({ email: schema.user.email, role: schema.user.role })
              .from(schema.user)
              .where(eq(schema.user.id, session.userId));
            if (row) {
              const role = roleFor(row.email, env.ADMIN_EMAILS);
              if (role !== row.role) {
                await db
                  .update(schema.user)
                  .set({ role })
                  .where(eq(schema.user.id, session.userId));
                logger.info(
                  { event: "auth.role.synced", userId: session.userId, role },
                  "role synced",
                );
              }
            }
            logger.info(
              { event: "auth.sign_in", userId: session.userId, method: methodFromPath(ctx?.path) },
              "signed in",
            );
          },
        },
      },
    },
    plugins: [
      magicLink({
        expiresIn: MAGIC_LINK_TTL_S,
        sendMagicLink: async ({ email, url }) => {
          logger.info(
            {
              event: "auth.magic_link.requested",
              emailHash: emailHash(email, env.BETTER_AUTH_SECRET),
              transport: env.EMAIL_TRANSPORT,
            },
            "sign-in link requested",
          );
          await sendMail(magicLinkMessage(email, url));
        },
      }),
      // Lets server actions set Better Auth cookies; must stay last.
      nextCookies(),
    ],
  } satisfies BetterAuthOptions;
}

function createAuth() {
  return betterAuth(authOptions());
}

export type Auth = ReturnType<typeof createAuth>;

/** The process-wide Better Auth instance (shared by the custom server and Next bundles). */
export function getAuth(): Auth {
  return processSingleton("auth", createAuth);
}
