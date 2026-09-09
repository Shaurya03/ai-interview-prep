import { describe, expect, it, vi } from "vitest";

import { generateKitDraft } from "../kit-generator.js";
import type { ExtractedRequirement } from "../requirement-extractor.js";
import type { GeneratedQuestion } from "../question-generator.js";

vi.mock("../requirement-extractor.js", () => ({
  extractRequirements: vi.fn(),
}));

vi.mock("../question-pipeline.js", () => ({
  generateQuestionPipeline: vi.fn(),
}));

import { extractRequirements } from "../requirement-extractor.js";
import { generateQuestionPipeline } from "../question-pipeline.js";

const mockedExtractRequirements = vi.mocked(extractRequirements);
const mockedGenerateQuestionPipeline = vi.mocked(
  generateQuestionPipeline
);

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
];

const questions: GeneratedQuestion[] = [
  {
    id: "q1",
    requirement_ids: ["r1"],
    category: "technical",
    prompt: "Explain the JavaScript event loop.",
    answer_outline: "Call stack; microtasks; macrotasks",
    difficulty: 2,
  },
  {
    id: "q2",
    requirement_ids: ["r2"],
    category: "technical",
    prompt: "How does React reconciliation work?",
    answer_outline: "Virtual DOM; reconciliation; rendering",
    difficulty: 2,
  },
];

describe("generateKitDraft", () => {
  it("extracts requirements and generates questions", async () => {
    mockedExtractRequirements.mockResolvedValue(requirements);

    mockedGenerateQuestionPipeline.mockResolvedValue({
      questions,
      uncoveredRequirementIds: [],
      passes: 1,
    });

    const result = await generateKitDraft(
      "Build a React application using JavaScript."
    );

    expect(result.requirements).toEqual(requirements);
    expect(result.questions).toEqual(questions);

    expect(result.coverage).toEqual({
      uncoveredRequirementIds: [],
      passes: 1,
    });

    expect(mockedExtractRequirements).toHaveBeenCalledTimes(1);
    expect(mockedExtractRequirements).toHaveBeenCalledWith(
      "Build a React application using JavaScript."
    );

    expect(mockedGenerateQuestionPipeline).toHaveBeenCalledTimes(1);
    expect(mockedGenerateQuestionPipeline).toHaveBeenCalledWith(
      requirements
    );
  });

  it("rejects an empty job description", async () => {
    await expect(
      generateKitDraft("   ")
    ).rejects.toThrow(
      "Job description cannot be empty."
    );

    expect(mockedExtractRequirements).not.toHaveBeenCalled();
    expect(mockedGenerateQuestionPipeline).not.toHaveBeenCalled();
  });

  it("preserves the number of passes used by the question pipeline", async () => {
    mockedExtractRequirements.mockResolvedValue(requirements);

    mockedGenerateQuestionPipeline.mockResolvedValue({
      questions,
      uncoveredRequirementIds: [],
      passes: 2,
    });

    const result = await generateKitDraft(
      "Build a React application using JavaScript."
    );

    expect(result.coverage.passes).toBe(2);
    expect(result.coverage.uncoveredRequirementIds).toEqual([]);
  });
});