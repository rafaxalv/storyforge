import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { log } from "../log";

/** Default model for every Claude feature (ARCHITECTURE.md §7); overridable per feature later. */
export const DEFAULT_MODEL = "claude-opus-5-5";

export interface CallMeta {
  /** Feature name, e.g. "inline-edit"; also the fixture folder for FakeClaude. */
  feature: string;
  /** Explicit fixture key; otherwise a hash of the request params is used. */
  fixture?: string;
}

/**
 * The only way storyforge talks to Claude. Features depend on this interface, never on the
 * SDK directly, so tests and local runs use FakeClaude and cannot reach the network.
 */
export interface ClaudeClient {
  readonly kind: "anthropic" | "fake";
  /** Streams the request and resolves with the final message; `onText` receives text deltas. */
  stream(
    params: Anthropic.MessageStreamParams,
    meta: CallMeta,
    onText?: (delta: string) => void,
  ): Promise<Anthropic.Message>;
}

export class AnthropicClaude implements ClaudeClient {
  readonly kind = "anthropic" as const;
  private readonly sdk: Anthropic;

  constructor(apiKey: string) {
    this.sdk = new Anthropic({ apiKey });
  }

  async stream(
    params: Anthropic.MessageStreamParams,
    _meta: CallMeta,
    onText?: (delta: string) => void,
  ): Promise<Anthropic.Message> {
    const stream = this.sdk.messages.stream(params);
    if (onText) stream.on("text", (delta) => onText(delta));
    return stream.finalMessage();
  }
}

export class MissingFixtureError extends Error {
  constructor(public readonly path: string) {
    super(`FakeClaude has no fixture at ${path}`);
    this.name = "MissingFixtureError";
  }
}

/** Minimal shape a fixture must have; the rest of the Message is filled with defaults. */
const FixtureSchema = z.object({
  content: z.array(z.object({ type: z.literal("text"), text: z.string() })).min(1),
  stop_reason: z
    .enum(["end_turn", "max_tokens", "stop_sequence", "tool_use", "pause_turn", "refusal"])
    .default("end_turn"),
  usage: z
    .object({
      input_tokens: z.number().int().nonnegative(),
      output_tokens: z.number().int().nonnegative(),
    })
    .default({ input_tokens: 0, output_tokens: 0 }),
});

/** Stable key for a request: sha256 of its JSON with sorted keys (first 16 hex chars). */
export function fixtureKey(params: unknown): string {
  const sorted = JSON.stringify(params, (_k, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
  return createHash("sha256").update(sorted).digest("hex").slice(0, 16);
}

/** Replays `<fixturesDir>/<feature>/<key>.json`. Never calls the network. */
export class FakeClaude implements ClaudeClient {
  readonly kind = "fake" as const;

  constructor(private readonly fixturesDir = join(process.cwd(), "tests", "fixtures", "claude")) {}

  async stream(
    params: Anthropic.MessageStreamParams,
    meta: CallMeta,
    onText?: (delta: string) => void,
  ): Promise<Anthropic.Message> {
    if (!/^[a-z0-9-]+$/.test(meta.feature))
      throw new Error(`Invalid feature name: ${meta.feature}`);
    const key = meta.fixture ?? fixtureKey(params);
    if (!/^[A-Za-z0-9_-]+$/.test(key)) throw new Error(`Invalid fixture key: ${key}`);
    const path = join(this.fixturesDir, meta.feature, `${key}.json`);

    let raw: string;
    try {
      raw = await readFile(path, "utf8");
    } catch {
      log("ai").error(
        { event: "ai.fixture.missing", feature: meta.feature, key },
        "no FakeClaude fixture",
      );
      throw new MissingFixtureError(path);
    }
    const fixture = FixtureSchema.parse(JSON.parse(raw));
    if (onText) for (const block of fixture.content) onText(block.text);

    const message: Anthropic.Message = {
      id: `msg_fake_${key}`,
      type: "message",
      role: "assistant",
      model: params.model,
      content: fixture.content.map((b) => ({ type: "text", text: b.text, citations: null })),
      stop_reason: fixture.stop_reason,
      stop_details: null,
      stop_sequence: null,
      container: null,
      diagnostics: null,
      usage: {
        input_tokens: fixture.usage.input_tokens,
        output_tokens: fixture.usage.output_tokens,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation: null,
        inference_geo: null,
        output_tokens_details: null,
        server_tool_use: null,
        service_tier: null,
        speed: null,
      },
    };
    return message;
  }
}

/** Picks the client from AI_CLIENT (default "fake"). */
export function getClaude(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ClaudeClient {
  const kind = env.AI_CLIENT === "anthropic" ? "anthropic" : "fake";
  log("ai").debug({ event: "ai.client", kind }, `Claude client: ${kind}`);
  if (kind === "anthropic") {
    const key = env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is required when AI_CLIENT=anthropic");
    return new AnthropicClaude(key);
  }
  return new FakeClaude();
}
