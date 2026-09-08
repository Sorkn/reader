import { describe, it, expect } from 'vitest';
import { isRagEnabled } from '@/services/ai/rag';
import type { AISettings } from '@/services/ai/types';

const settings = (over: Partial<AISettings>): AISettings =>
  ({
    enabled: true,
    provider: 'openrouter',
    ollamaBaseUrl: '',
    ollamaModel: '',
    ollamaEmbeddingModel: '',
    spoilerProtection: false,
    maxContextChunks: 5,
    indexingMode: 'on-demand',
    ...over,
  }) as AISettings;

describe('isRagEnabled', () => {
  it('is off when the provider has no embedding model', () => {
    expect(isRagEnabled(settings({ provider: 'openrouter', openrouterEmbeddingModel: '' }))).toBe(
      false,
    );
    expect(
      isRagEnabled(settings({ provider: 'openrouter', openrouterEmbeddingModel: undefined })),
    ).toBe(false);
  });

  it('is on when the provider has an embedding model', () => {
    expect(
      isRagEnabled(settings({ provider: 'openrouter', openrouterEmbeddingModel: 'text-embed-3' })),
    ).toBe(true);
  });

  it('reads the field belonging to the active provider', () => {
    // Ollama selected, only the OpenAI-compatible field filled in: still off.
    expect(
      isRagEnabled(
        settings({
          provider: 'ollama',
          ollamaEmbeddingModel: '',
          openrouterEmbeddingModel: 'text-embed-3',
        }),
      ),
    ).toBe(false);
    expect(isRagEnabled(settings({ provider: 'ollama', ollamaEmbeddingModel: 'nomic' }))).toBe(
      true,
    );
  });

  it('covers the gateway provider', () => {
    expect(
      isRagEnabled(settings({ provider: 'ai-gateway', aiGatewayEmbeddingModel: 'embed-v1' })),
    ).toBe(true);
    expect(isRagEnabled(settings({ provider: 'ai-gateway', aiGatewayEmbeddingModel: '' }))).toBe(
      false,
    );
  });

  it('treats whitespace as unset', () => {
    expect(
      isRagEnabled(settings({ provider: 'openrouter', openrouterEmbeddingModel: '   ' })),
    ).toBe(false);
  });
});
