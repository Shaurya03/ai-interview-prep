import type { ExtractedRequirement } from "./requirement-extractor.js";
import type { GeneratedQuestion } from "./question-generator.js";

export interface CoverageResult {
  uncoveredRequirementIds: string[];
  coveredRequirementIds: string[];
}

export function checkCoverage(
  requirements: ExtractedRequirement[],
  questions: GeneratedQuestion[]
): CoverageResult {
  const coveredRequirementIds = new Set(
    questions.flatMap((question) => question.requirement_ids)
  );

  const uncoveredRequirementIds = requirements
    .filter(
      (requirement) =>
        requirement.priority === "must" &&
        !coveredRequirementIds.has(requirement.id)
    )
    .map((requirement) => requirement.id);

  return {
    coveredRequirementIds: Array.from(coveredRequirementIds),
    uncoveredRequirementIds,
  };
}