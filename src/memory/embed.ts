import { type EmbeddingModel, embed, embedMany } from 'ai';

export interface Embedder {
  one(text: string): Promise<number[]>;
  many(texts: string[]): Promise<number[][]>;
}

/** Thin wrapper so the store can be tested with a mock embedding model. */
export function createEmbedder(model: EmbeddingModel): Embedder {
  return {
    async one(text) {
      const { embedding } = await embed({ model, value: text });
      return embedding;
    },
    async many(texts) {
      if (texts.length === 0) return [];
      const { embeddings } = await embedMany({ model, values: texts });
      return embeddings;
    },
  };
}
