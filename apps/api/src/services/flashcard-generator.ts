import { z } from "zod";

import { generateJson } from "./llm.js";
import type { ExtractedRequirement } from "./requirement-extractor.js";

const generatedFlashcardSchema = z.object({
  front: z.string().trim().min(1),
  back: z.string().trim().min(1),
  requirement_ids: z.array(z.string()).min(1),
});

const flashcardGenerationResponseSchema = z.object({
  flashcards: z.array(generatedFlashcardSchema).min(1),
});

export interface GeneratedFlashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
}

export async function generateFlashcards(
  requirements: ExtractedRequirement[]
): Promise<GeneratedFlashcard[]> {
  if (requirements.length === 0) {
    throw new Error(
      "Cannot generate flashcards without requirements."
    );
  }

  const requirementText = requirements
    .map(
      (requirement) =>
        `ID: ${requirement.id}
TEXT: ${requirement.text}
KIND: ${requirement.kind}
PRIORITY: ${requirement.priority}`
    )
    .join("\n\n");

  const targetCount = Math.min(
    40,
    Math.max(5, Math.ceil(requirements.length * 1.25))
  );

  const prompt = `
You are generating study flashcards for a personalized interview preparation tool.

Generate approximately ${targetCount} useful flashcards based only on the supplied requirements.

Do not generate exactly one flashcard per requirement automatically.
Use judgment about which concepts are worth memorizing.

Prioritize must-have requirements.

Every flashcard must reference one or more valid requirement IDs.

Do not invent technologies, responsibilities, qualifications, or concepts that are not reasonably represented by the supplied requirements.

Flashcards should be concise and useful for interview preparation.

The "front" should be a short question, concept, term, or prompt.

The "back" should contain the key facts or points a candidate should remember.
Keep the back concise. Do not write an essay.

Avoid duplicate or near-duplicate flashcards.

Return JSON only in this format:

{
  "flashcards": [
    {
      "front": "...",
      "back": "...",
      "requirement_ids": ["r1"]
    }
  ]
}

Requirements:

${requirementText}
`;

  const raw = await generateJson<unknown>(prompt);

  const parsed =
    flashcardGenerationResponseSchema.parse(raw);

  const validRequirementIds = new Set(
    requirements.map((requirement) => requirement.id)
  );

  for (const flashcard of parsed.flashcards) {
    for (const requirementId of flashcard.requirement_ids) {
      if (!validRequirementIds.has(requirementId)) {
        throw new Error(
          `Flashcard references unknown requirement ID: ${requirementId}`
        );
      }
    }
  }

  return parsed.flashcards.map((flashcard, index) => ({
    ...flashcard,
    id: `f${index + 1}`,
  }));
}