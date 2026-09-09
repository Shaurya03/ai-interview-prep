import { GoogleGenAI } from "@google/genai";

const MAX_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateJson<T>(prompt: string): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
  const ai = new GoogleGenAI({ apiKey });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const text = response.text;

      if (!text) {
        throw new Error("LLM returned an empty response.");
      }

      try {
        return JSON.parse(text) as T;
      } catch {
        throw new Error("LLM returned invalid JSON.");
      }
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        throw error;
      }

      const delayMs = 1000 * 2 ** (attempt - 1);

      console.log(
        `LLM request failed on attempt ${attempt}. Retrying in ${delayMs}ms...`
      );

      await sleep(delayMs);
    }
  }

  throw new Error("LLM generation failed.");
}