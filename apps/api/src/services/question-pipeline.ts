import { checkCoverage } from "./coverage-checker.js";
import {
  generateQuestions,
  type GeneratedQuestion,
} from "./question-generator.js";
import type { ExtractedRequirement } from "./requirement-extractor.js";

const MAX_PASSES = 2;

export interface QuestionPipelineResult {
  questions: GeneratedQuestion[];
  uncoveredRequirementIds: string[];
  passes: number;
}

export async function generateQuestionPipeline(
  requirements: ExtractedRequirement[]
): Promise<QuestionPipelineResult> {
  if (requirements.length === 0) {
    throw new Error("Cannot generate questions without requirements.");
  }

  // First pass: generate the main question bank.
  let questions = await generateQuestions(requirements);

  let coverage = checkCoverage(requirements, questions);
  let passes = 1;

  // Second pass: repair any uncovered must-have requirements.
  if (coverage.uncoveredRequirementIds.length > 0) {
    const repairQuestions = await generateQuestions(requirements, {
      focusRequirementIds: coverage.uncoveredRequirementIds,
      targetQuestionCount: Math.max(
        2,
        coverage.uncoveredRequirementIds.length * 2
      ),
    });

    // Give repair questions new IDs so they don't collide with
    // questions generated during the first pass.
    const nextQuestionNumber = questions.length + 1;

    const numberedRepairQuestions = repairQuestions.map(
      (question, index) => ({
        ...question,
        id: `q${nextQuestionNumber + index}`,
      })
    );

    questions = [...questions, ...numberedRepairQuestions];

    passes = 2;

    // Check coverage again after the repair pass.
    coverage = checkCoverage(requirements, questions);

    if (coverage.uncoveredRequirementIds.length > 0) {
      throw new Error(
        `Question generation could not cover all must-have requirements after ${MAX_PASSES} passes. Uncovered requirements: ${coverage.uncoveredRequirementIds.join(", ")}`
      );
    }
  }

  return {
    questions,
    uncoveredRequirementIds: coverage.uncoveredRequirementIds,
    passes,
  };
}