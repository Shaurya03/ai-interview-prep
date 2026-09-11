import { GoogleGenAI } from "@google/genai";

const MAX_TRANSIENT_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1000, 2000];

let nextModelIndex = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getModels(): string[] {
  const primaryModel =
    process.env.GEMINI_MODEL ?? "gemini-3.8-flash";

  const fallbackModels = (process.env.GEMINI_FALLBACK_MODELS ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  return [...new Set([primaryModel, ...fallbackModels])];
}

function getErrorDetails(error: unknown): {
  status?: number;
  message: string;
} {
  if (!error || typeof error !== "object") {
    return {
      message: String(error ?? "Unknown error"),
    };
  }

  const possibleError = error as {
    status?: number;
    message?: string;
  };

  return {
    status: possibleError.status,
    message: possibleError.message?.toLowerCase() ?? "",
  };
}

function isQuotaError(error: unknown): boolean {
  const { status, message } = getErrorDetails(error);

  if (status === 429) {
    return true;
  }

  return (
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("resource exhausted") ||
    message.includes("requests per minute") ||
    message.includes("requests per day")
  );
}

function isTransientServerError(error: unknown): boolean {
  const { status, message } = getErrorDetails(error);

  if (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return true;
  }

  return (
    message.includes("internal server error") ||
    message.includes("bad gateway") ||
    message.includes("service unavailable") ||
    message.includes("temporarily unavailable") ||
    message.includes("high demand")
  );
}

function isRetryableGenerationError(error: unknown): boolean {
  if (isQuotaError(error)) {
    return true;
  }

  if (isTransientServerError(error)) {
    return true;
  }

  const { message } = getErrorDetails(error);

  return (
    message.includes("llm returned an empty response") ||
    message.includes("llm returned invalid json")
  );
}

export async function generateJson<T>(prompt: string): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const models = getModels();

  if (models.length === 0) {
    throw new Error("No LLM models are configured.");
  }

  /*
   * Rotate the starting model for every request.
   *
   * This prevents every generation step from hammering the same
   * free-tier model until its quota is exhausted.
   */
  const startIndex = nextModelIndex % models.length;
  nextModelIndex = (nextModelIndex + 1) % models.length;

  const orderedModels = [
    ...models.slice(startIndex),
    ...models.slice(0, startIndex),
  ];

  let lastError: unknown;

  for (const model of orderedModels) {
    console.log(`Trying LLM model: ${model}`);

    for (
      let attempt = 1;
      attempt <= MAX_TRANSIENT_ATTEMPTS;
      attempt++
    ) {
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

        const quotaError = isQuotaError(error);
        const retryableError =
          isRetryableGenerationError(error);

        if (!retryableError) {
          throw error;
        }

        /*
         * Quota errors should immediately move to another model.
         * Retrying the same exhausted quota is pointless.
         */
        if (quotaError) {
          console.log(
            `LLM model ${model} hit a quota/rate-limit error. ` +
            `Moving to the next configured model.`
          );
          break;
        }

        if (attempt === MAX_TRANSIENT_ATTEMPTS) {
          console.log(
            `LLM model ${model} failed after ` +
            `${MAX_TRANSIENT_ATTEMPTS} attempts.`
          );
          break;
        }

        const delayMs =
          RETRY_DELAYS_MS[attempt - 1] ??
          RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];

        console.log(
          `LLM request failed for ${model} on attempt ` +
          `${attempt}. Retrying in ${delayMs}ms...`
        );

        await sleep(delayMs);
      }
    }
  }

  throw new Error(
    `All configured LLM models failed. Last error: ${lastError instanceof Error
      ? lastError.message
      : "Unknown LLM error."
    }`
  );
}