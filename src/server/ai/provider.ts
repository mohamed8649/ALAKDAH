import 'server-only';

import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

/**
 * AI provider abstraction.
 *
 * Prompt construction lives on the server, never in the browser: a prompt in a
 * client bundle is a prompt anyone can rewrite. The provider interface below is
 * the only thing the AI services talk to.
 *
 * Two implementations ship: `mock`, which is deterministic and needs no
 * network, and `anthropic`. The mock is the default so the product is fully
 * usable — and testable — without an API key.
 */

export interface CompletionRequest {
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  /** Deterministic seed for the mock provider. */
  seed?: string;
}

export interface CompletionResult {
  text: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Estimated cost in USD micro-units (1_000_000 = $1). */
  costMicros: number;
}

export interface AiProvider {
  readonly key: string;
  readonly model: string;
  complete(request: CompletionRequest): Promise<CompletionResult>;
}

/** Rough token estimate. Arabic averages fewer characters per token than English. */
function estimateTokens(text: string): number {
  const arabicChars = (text.match(/[؀-ۿ]/g) ?? []).length;
  const otherChars = text.length - arabicChars;
  return Math.ceil(arabicChars / 2 + otherChars / 4);
}

// ---------------------------------------------------------------------------
// Mock provider
// ---------------------------------------------------------------------------

/**
 * Deterministic offline provider.
 *
 * Produces plausible Arabic marketing copy assembled from the structured prompt
 * the caller built. It is explicitly not a language model: it exists so the
 * whole AI flow — generate, review, edit, save, cost accounting — works and can
 * be tested without a key or a network call.
 */
class MockProvider implements AiProvider {
  readonly key = 'mock';
  readonly model = 'mock-v1';

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    // A small delay keeps the loading state honest in development.
    await new Promise((resolve) => setTimeout(resolve, 350));

    const payload = safeParse(request.prompt);
    const text = payload ? renderFromPayload(payload, request.seed ?? '') : request.prompt.slice(0, 600);

    return {
      text,
      provider: this.key,
      model: this.model,
      inputTokens: estimateTokens(request.system + request.prompt),
      outputTokens: estimateTokens(text),
      costMicros: 0,
    };
  }
}

function safeParse(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const TONE_OPENERS: Record<string, string[]> = {
  professional: ['مصمم ليلبي احتياجك اليومي بكفاءة.', 'خيار عملي يجمع بين الجودة والسعر المناسب.'],
  friendly: ['هتحبه من أول استخدام.', 'بسيط، عملي، ومناسب لكل يوم.'],
  luxury: ['تفاصيل مصنوعة بعناية لمن يقدّر الفرق.', 'حضور هادئ وأناقة لا تحتاج مبالغة.'],
  energetic: ['جاهز يواكب إيقاعك السريع.', 'أداء قوي بلا تنازلات.'],
  simple: ['منتج عملي يؤدي الغرض.', 'واضح ومباشر، بدون تعقيد.'],
};

function renderFromPayload(payload: Record<string, unknown>, seed: string): string {
  const name = String(payload.name ?? 'المنتج');
  const tone = String(payload.tone ?? 'professional');
  const length = String(payload.length ?? 'medium');
  const features = Array.isArray(payload.features)
    ? (payload.features as unknown[]).map(String).filter(Boolean)
    : [];
  const category = payload.category ? String(payload.category) : null;
  const instructions = payload.instructions ? String(payload.instructions) : null;

  const openers = TONE_OPENERS[tone] ?? TONE_OPENERS.professional!;
  const opener = openers[hash(seed + name) % openers.length]!;

  const parts: string[] = [];
  parts.push(`${name} — ${opener}`);

  if (category) {
    parts.push(`ينتمي إلى فئة ${category}، ومناسب للاستخدام اليومي.`);
  }

  if (features.length > 0) {
    parts.push('');
    parts.push('أبرز المزايا:');
    for (const feature of features.slice(0, 8)) {
      parts.push(`• ${feature}`);
    }
  }

  if (length !== 'short') {
    parts.push('');
    parts.push(
      'تم اختيار الخامات والتفاصيل بعناية ليكون الاستخدام مريحاً على المدى الطويل، مع تركيز على ما يهم فعلاً: الجودة، السعر المناسب، وسهولة الاستخدام.',
    );
  }

  if (length === 'long') {
    parts.push('');
    parts.push(
      'يمكنك طلبه الآن مع الدفع عند الاستلام، ونتواصل معك لتأكيد الطلب قبل الشحن. إن احتجت أي توضيح إضافي قبل الشراء، فريقنا جاهز للرد.',
    );
  }

  if (instructions) {
    parts.push('');
    parts.push(instructions);
  }

  return parts.join('\n');
}

function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Anthropic provider
// ---------------------------------------------------------------------------

/** Pricing in USD micro-units per million tokens. */
const ANTHROPIC_PRICING = { inputPerMillion: 3_000_000, outputPerMillion: 15_000_000 };

class AnthropicProvider implements AiProvider {
  readonly key = 'anthropic';
  readonly model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5';

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new AppError('AI_GENERATION_FAILED', 'ANTHROPIC_API_KEY is not configured.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: request.maxTokens ?? 1500,
          temperature: request.temperature ?? 0.7,
          system: request.system,
          messages: [{ role: 'user', content: request.prompt }],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        logger.error('anthropic request failed', new Error(body.slice(0, 500)), {
          entityType: 'ai',
        });
        throw new AppError('AI_GENERATION_FAILED', 'The AI provider returned an error.');
      }

      const payload = (await response.json()) as {
        content: Array<{ type: string; text?: string }>;
        usage: { input_tokens: number; output_tokens: number };
      };

      const text = payload.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text ?? '')
        .join('\n')
        .trim();

      const inputTokens = payload.usage.input_tokens;
      const outputTokens = payload.usage.output_tokens;

      return {
        text,
        provider: this.key,
        model: this.model,
        inputTokens,
        outputTokens,
        costMicros: Math.round(
          (inputTokens / 1_000_000) * ANTHROPIC_PRICING.inputPerMillion +
            (outputTokens / 1_000_000) * ANTHROPIC_PRICING.outputPerMillion,
        ),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('AI_GENERATION_FAILED', 'Could not reach the AI provider.');
    } finally {
      clearTimeout(timeout);
    }
  }
}

let provider: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (provider) return provider;
  provider = process.env.AI_PROVIDER === 'anthropic' ? new AnthropicProvider() : new MockProvider();
  return provider;
}

/** Test seam. */
export function setAiProvider(next: AiProvider): void {
  provider = next;
}
