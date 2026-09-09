import { GoogleGenAI } from "@google/genai";

const MAX_ATTEMPTS_PER_MODEL = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getModels(): string[] {
  const primaryModel = process.env.GEMINI_MODEL ?? "gemini-3.7-flash";

  const fallbackModels = (process.env.GEMINI_FALLBACK_MODELS ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  return [...new Set([primaryModel, ...fallbackModels])];
}

function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const possibleError = error as {
    status?: number;
    message?: string;
  };

  if (
    possibleError.status === 429 ||
    possibleError.status === 500 ||
    possibleError.status === 502 ||
    possibleError.status === 503 ||
    possibleError.status === 504
  ) {
    return true;
  }

  const message = possibleError.message?.toLowerCase() ?? "";

  return (
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("high demand") ||
    message.includes("temporarily unavailable")
  );
}

export async function generateJson<T>(prompt: string): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const models = getModels();

  let lastError: unknown;

  for (const model of models) {
    console.log(`Trying LLM model: ${model}`);

    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
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
        lastError = error;

        if (!isRetryableError(error)) {
          throw error;
        }

        if (attempt === MAX_ATTEMPTS_PER_MODEL) {
          console.log(
            `LLM model ${model} failed after ${MAX_ATTEMPTS_PER_MODEL} attempts.`
          );
          break;
        }

        const delayMs = 1000 * 2 ** (attempt - 1);

        console.log(
          `LLM request failed for ${model} on attempt ${attempt}. ` +
          `Retrying in ${delayMs}ms...`
        );

        await sleep(delayMs);
      }
    }

    console.log(`Moving to next LLM model after failure: ${model}`);
  }

  throw new Error(
    `All configured LLM models failed. Last error: ${lastError instanceof Error
      ? lastError.message
      : "Unknown LLM error."
    }`
  );
}