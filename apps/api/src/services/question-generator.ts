import { z } from "zod";
import { generateJson } from "./llm.js";
import type { ExtractedRequirement } from "./requirement-extractor.js";

const generatedQuestionSchema = z.object({
  requirement_ids: z.array(z.string()).min(1),
  category: z.enum([
    "technical",
    "behavioural",
    "system-design",
    "company-fit",
  ]),
  prompt: z.string().trim().min(1),
  answer_outline: z.string().trim().min(1),
  difficulty: z.number().int().min(1).max(3),
});

const questionGenerationResponseSchema = z.union([
  z.object({
    questions: z.array(generatedQuestionSchema).min(1),
  }),
  z.array(generatedQuestionSchema).min(1),
]);

export interface GeneratedQuestion {
  id: string;
  requirement_ids: string[];
  category:
  | "technical"
  | "behavioural"
  | "system-design"
  | "company-fit";
  prompt: string;
  answer_outline: string;
  difficulty: number;
}

interface GenerateQuestionsOptions {
  targetQuestionCount?: number;
  focusRequirementIds?: string[];
}

export async function generateQuestions(
  requirements: ExtractedRequirement[],
  options?: GenerateQuestionsOptions
): Promise<GeneratedQuestion[]> {
  if (requirements.length === 0) {
    throw new Error("Cannot generate questions without requirements.");
  }

  const targetQuestionCount =
    options?.targetQuestionCount ??
    Math.min(
      40,
      Math.max(
        requirements.length,
        Math.ceil(requirements.length * 1.5)
      )
    );

  const focusRequirements = options?.focusRequirementIds
    ? requirements.filter((requirement) =>
      options.focusRequirementIds?.includes(requirement.id)
    )
    : [];

  const mustHaveCount = requirements.filter(
    (requirement) => requirement.priority === "must"
  ).length;

  const niceToHaveCount = requirements.filter(
    (requirement) => requirement.priority === "nice"
  ).length;

  const requirementText = requirements
    .map(
      (requirement) =>
        `ID: ${requirement.id}
TEXT: ${requirement.text}
KIND: ${requirement.kind}
PRIORITY: ${requirement.priority}`
    )
    .join("\n\n");

  const focusInstructions =
    focusRequirements.length > 0
      ? `
This is a COVERAGE REPAIR PASS.

The previous question-generation pass left these must-have requirements
without a question:

${focusRequirements
        .map(
          (requirement) =>
            `ID: ${requirement.id}
TEXT: ${requirement.text}
PRIORITY: ${requirement.priority}`
        )
        .join("\n\n")}

Generate questions specifically designed to cover these requirements.

Every focused requirement MUST be covered by at least one generated question.

Do not spend the majority of this pass generating questions for unrelated
requirements.
`
      : `
This is the INITIAL QUESTION GENERATION PASS.

Generate a useful question bank from the supplied requirements.
`;

  const prompt = `
You are generating an interview question bank for a personalized interview
preparation tool.

${focusInstructions}

Generate approximately ${targetQuestionCount} strong interview questions.

There are:
- ${mustHaveCount} must-have requirements
- ${niceToHaveCount} nice-to-have requirements

Do NOT generate exactly one question per requirement.

Instead:
- Important must-have requirements may receive multiple questions.
- Related requirements may be tested together when that produces a stronger
  question.
- Use fewer questions for minor or simple requirements.
- Avoid repetitive questions that test the same thing in slightly different
  words.
- Do not create questions solely to reach the target count.
- For a thin job description, generate a correspondingly smaller and more
  focused question bank.

Every question MUST reference one or more requirement IDs that it genuinely
tests.

Do not invent technologies, responsibilities, qualifications, company
expectations, or interview requirements that are not represented by the
supplied requirements.

Category rules:
- "technical": programming languages, frameworks, databases, APIs,
  authentication, testing, deployment, Git, etc.
- "behavioural": communication, collaboration, independence, problem-solving,
  mentoring, teamwork, etc.
- "system-design": architecture, scalability, reliability, system
  decomposition, API/system architecture, or similar design topics when
  supported by the requirements.
- "company-fit": motivation, company-specific fit, role expectations, or
  company-oriented questions when supported by the requirements.

Do not force a category if the requirements do not justify it.

Difficulty:
- 1 = basic
- 2 = intermediate
- 3 = advanced

Answer outline:
- Keep it concise.
- Give the main points a strong candidate should discuss.
- Use roughly 3-6 concise points.
- Do not write a complete essay answer.

Requirement IDs must be copied exactly from the supplied requirements.

Return exactly this JSON structure:

{
  "questions": [
    {
      "requirement_ids": ["r1"],
      "category": "technical",
      "prompt": "Example question",
      "answer_outline": "Point 1; Point 2; Point 3",
      "difficulty": 2
    }
  ]
}

Do not return the questions array directly.
It must be inside the "questions" property.

Requirements:

${requirementText}
`;

  const raw = await generateJson<unknown>(prompt);
  const parsed = questionGenerationResponseSchema.parse(raw);

  // Gemini may occasionally return the array directly despite the requested
  // wrapper, so normalize both valid shapes here.
  const questions = Array.isArray(parsed)
    ? parsed
    : parsed.questions;

  const validRequirementIds = new Set(
    requirements.map((requirement) => requirement.id)
  );

  for (const question of questions) {
    for (const requirementId of question.requirement_ids) {
      if (!validRequirementIds.has(requirementId)) {
        throw new Error(
          `Question references unknown requirement ID: ${requirementId}`
        );
      }
    }
  }

  return questions.map((question, index) => ({
    ...question,
    id: `q${index + 1}`,
  }));
}