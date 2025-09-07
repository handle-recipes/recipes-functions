import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

/**
 * Generates embedding vector for given text using Google GenAI.
 * @param {string} text - The text to generate embedding for
 * @return {Promise<number[]>} The embedding values
 * @throws {Error} When embedding generation fails
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
  });

  if (!response.embeddings || !response.embeddings[0]?.values) {
    throw new Error("Failed to generate embedding");
  }

  return response.embeddings[0].values;
}
