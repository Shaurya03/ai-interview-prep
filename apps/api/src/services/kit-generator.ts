import { extractRequirements } from "./requirement-extractor.js";
import {
  generateQuestionPipeline,
  type QuestionPipelineResult,
} from "./question-pipeline.js";

export interface GeneratedKitDraft {
  requirements: Awaited<ReturnType<typeof extractRequirements>>;
  questions: QuestionPipelineResult["questions"];
  coverage: {
    uncoveredRequirementIds: string[];
    passes: number;
  };
}

export async function generateKitDraft(
  jobDescription: string
): Promise<GeneratedKitDraft> {
  if (!jobDescription.trim()) {
    throw new Error("Job description cannot be empty.");
  }

  // Step 1: extract requirements from the job description.
  const requirements = await extractRequirements(jobDescription);

  // Step 2: generate questions and repair any uncovered must-have
  // requirements through the question pipeline.
  const questionResult = await generateQuestionPipeline(
    requirements
  );

  return {
    requirements,
    questions: questionResult.questions,
    coverage: {
      uncoveredRequirementIds:
        questionResult.uncoveredRequirementIds,
      passes: questionResult.passes,
    },
  };
}