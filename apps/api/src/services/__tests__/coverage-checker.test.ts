import { describe, expect, it } from "vitest";
import {
  checkCoverage,
  type CoverageResult,
} from "../coverage-checker.js";
import type { ExtractedRequirement } from "../requirement-extractor.js";
import type { GeneratedQuestion } from "../question-generator.js";

const requirements: ExtractedRequirement[] = [
  {
    id: "r1",
    text: "Strong JavaScript fundamentals",
    kind: "technical",
    priority: "must",
  },
  {
    id: "r2",
    text: "Experience with React",
    kind: "technical",
    priority: "must",
  },
  {
    id: "r3",
    text: "Experience with Docker",
    kind: "technical",
    priority: "nice",
  },
];

function question(
  id: string,
  requirementIds: string[]
): GeneratedQuestion {
  return {
    id,
    requirement_ids: requirementIds,
    category: "technical",
    prompt: `Question ${id}`,
    answer_outline: "Point 1; Point 2; Point 3",
    difficulty: 2,
  };
}

describe("checkCoverage", () => {
  it("identifies uncovered must-have requirements", () => {
    const questions = [
      question("q1", ["r1"]),
      question("q2", ["r1", "r3"]),
    ];

    const result: CoverageResult = checkCoverage(
      requirements,
      questions
    );

    expect(result.coveredRequirementIds).toEqual([
      "r1",
      "r3",
    ]);

    expect(result.uncoveredRequirementIds).toEqual(["r2"]);
  });

  it("does not require nice-to-have requirements to be covered", () => {
    const questions = [
      question("q1", ["r1"]),
      question("q2", ["r2"]),
    ];

    const result = checkCoverage(
      requirements,
      questions
    );

    expect(result.uncoveredRequirementIds).toEqual([]);
  });

  it("returns no uncovered requirements when all must-haves are covered", () => {
    const questions = [
      question("q1", ["r1"]),
      question("q2", ["r2"]),
    ];

    const result = checkCoverage(
      requirements,
      questions
    );

    expect(result.uncoveredRequirementIds).toEqual([]);
  });

  it("handles a question covering multiple requirements", () => {
    const questions = [
      question("q1", ["r1", "r2"]),
    ];

    const result = checkCoverage(
      requirements,
      questions
    );

    expect(result.coveredRequirementIds).toEqual([
      "r1",
      "r2",
    ]);

    expect(result.uncoveredRequirementIds).toEqual([]);
  });
});