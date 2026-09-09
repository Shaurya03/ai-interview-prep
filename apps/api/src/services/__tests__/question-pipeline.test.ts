import { describe, expect, it, vi } from "vitest";

import { checkCoverage } from "../coverage-checker.js";
import {
  generateQuestionPipeline,
} from "../question-pipeline.js";
import type { ExtractedRequirement } from "../requirement-extractor.js";
import type { GeneratedQuestion } from "../question-generator.js";

vi.mock("../question-generator.js", () => ({
  generateQuestions: vi.fn(),
}));

import { generateQuestions } from "../question-generator.js";

const mockedGenerateQuestions = vi.mocked(generateQuestions);

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

describe("generateQuestionPipeline", () => {
  it("finishes after the first pass when all must-haves are covered", async () => {
    mockedGenerateQuestions.mockResolvedValueOnce([
      question("q1", ["r1"]),
      question("q2", ["r2"]),
      question("q3", ["r3"]),
    ]);

    const result = await generateQuestionPipeline(requirements);

    expect(result.passes).toBe(1);
    expect(result.uncoveredRequirementIds).toEqual([]);
    expect(result.questions).toHaveLength(3);

    expect(mockedGenerateQuestions).toHaveBeenCalledTimes(1);
  });

  it("runs a second pass when a must-have requirement is uncovered", async () => {
    mockedGenerateQuestions
      .mockResolvedValueOnce([
        question("q1", ["r1"]),
        question("q2", ["r3"]),
      ])
      .mockResolvedValueOnce([
        question("q1", ["r2"]),
      ]);

    const result = await generateQuestionPipeline(requirements);

    expect(result.passes).toBe(2);
    expect(result.uncoveredRequirementIds).toEqual([]);
    expect(result.questions).toHaveLength(3);

    expect(mockedGenerateQuestions).toHaveBeenCalledTimes(2);

    expect(mockedGenerateQuestions).toHaveBeenNthCalledWith(
      2,
      requirements,
      {
        focusRequirementIds: ["r2"],
        targetQuestionCount: 2,
      }
    );
  });

  it("throws when must-have requirements remain uncovered after the second pass", async () => {
    mockedGenerateQuestions
      .mockResolvedValueOnce([
        question("q1", ["r1"]),
      ])
      .mockResolvedValueOnce([
        question("q2", ["r1"]),
      ]);

    await expect(
      generateQuestionPipeline(requirements)
    ).rejects.toThrow(
      "Question generation could not cover all must-have requirements after 2 passes."
    );

    expect(mockedGenerateQuestions).toHaveBeenCalledTimes(2);
  });

  it("does not require nice-to-have requirements during the repair pass", async () => {
    mockedGenerateQuestions.mockResolvedValueOnce([
      question("q1", ["r1"]),
      question("q2", ["r2"]),
    ]);

    const result = await generateQuestionPipeline(requirements);

    expect(result.passes).toBe(1);
    expect(result.uncoveredRequirementIds).toEqual([]);
    expect(mockedGenerateQuestions).toHaveBeenCalledTimes(1);

    const coverage = checkCoverage(
      requirements,
      result.questions
    );

    expect(coverage.uncoveredRequirementIds).toEqual([]);
  });
});