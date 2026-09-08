import type { AISettings } from './types';

/**
 * Whether retrieval over the whole book is configured.
 *
 * The settings panel offers "None (disable RAG)" as an empty embedding model,
 * and the chat adapter already copes with an unindexed book by sending no
 * chunks. This is the predicate that lets the rest of the UI honour that
 * choice instead of demanding an index the reader never asked for.
 */
export const isRagEnabled = (settings: AISettings): boolean => {
  const model =
    settings.provider === 'ollama'
      ? settings.ollamaEmbeddingModel
      : settings.provider === 'ai-gateway'
        ? settings.aiGatewayEmbeddingModel
        : settings.openrouterEmbeddingModel;
  return !!model?.trim();
};
