import { describe, expect, it, vi } from "vitest";

import { generateKitDraft } from "../kit-generator.js";
import type { ExtractedRequirement } from "../requirement-extractor.js";
import type { GeneratedQuestion } from "../question-generator.js";
import type { ResearchResult } from "../researcher.js";
import type { CompanyBrief } from "../company-brief-generator.js";

vi.mock("../requirement-extractor.js", () => ({
  extractRequirements: vi.fn(),
}));

vi.mock("../researcher.js", () => ({
  researchCompany: vi.fn(),
}));

vi.mock("../company-brief-generator.js", () => ({
  generateCompanyBrief: vi.fn(),
}));

vi.mock("../question-pipeline.js", () => ({
  generateQuestionPipeline: vi.fn(),
}));

import { extractRequirements } from "../requirement-extractor.js";
import { researchCompany } from "../researcher.js";
import { generateCompanyBrief } from "../company-brief-generator.js";
import { generateQuestionPipeline } from "../question-pipeline.js";

const mockedExtractRequirements = vi.mocked(extractRequirements);
const mockedResearchCompany = vi.mocked(researchCompany);
const mockedGenerateCompanyBrief = vi.mocked(generateCompanyBrief);
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

const research: ResearchResult = {
  pages: [
    {
      url: "https://example.com/",
      title: "Example",
      text: "Example company research content.",
    },
  ],
  pagesUsed: ["https://example.com/"],
  gaps: [],
};

const companyBrief: CompanyBrief = {
  summary: "Example is a technology company.",
  what_they_do: "They build technology products.",
  sources: ["https://example.com/"],
};

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

const jobDescription =
  "Build a React application using JavaScript.";

const companyUrl = "https://example.com/";

describe("generateKitDraft", () => {
  it("orchestrates requirements, research, company brief, and questions", async () => {
    mockedExtractRequirements.mockResolvedValue(requirements);

    mockedResearchCompany.mockResolvedValue(research);

    mockedGenerateCompanyBrief.mockResolvedValue(companyBrief);

    mockedGenerateQuestionPipeline.mockResolvedValue({
      questions,
      uncoveredRequirementIds: [],
      passes: 1,
    });

    const result = await generateKitDraft(
      jobDescription,
      companyUrl
    );

    expect(result.requirements).toEqual(requirements);
    expect(result.research).toEqual(research);
    expect(result.companyBrief).toEqual(companyBrief);
    expect(result.questions).toEqual(questions);

    expect(result.coverage).toEqual({
      uncoveredRequirementIds: [],
      passes: 1,
    });

    expect(mockedExtractRequirements).toHaveBeenCalledTimes(1);
    expect(mockedExtractRequirements).toHaveBeenCalledWith(
      jobDescription
    );

    expect(mockedResearchCompany).toHaveBeenCalledTimes(1);
    expect(mockedResearchCompany).toHaveBeenCalledWith(
      companyUrl
    );

    expect(mockedGenerateCompanyBrief).toHaveBeenCalledTimes(1);
    expect(mockedGenerateCompanyBrief).toHaveBeenCalledWith(
      companyUrl,
      research
    );

    expect(mockedGenerateQuestionPipeline).toHaveBeenCalledTimes(
      1
    );
    expect(mockedGenerateQuestionPipeline).toHaveBeenCalledWith(
      requirements,
      {
        companyBrief,
      }
    );
  });

  it("rejects an empty job description", async () => {
    await expect(
      generateKitDraft("   ", companyUrl)
    ).rejects.toThrow(
      "Job description cannot be empty."
    );

    expect(mockedExtractRequirements).not.toHaveBeenCalled();
    expect(mockedResearchCompany).not.toHaveBeenCalled();
    expect(mockedGenerateCompanyBrief).not.toHaveBeenCalled();
    expect(mockedGenerateQuestionPipeline).not.toHaveBeenCalled();
  });

  it("rejects an empty company URL", async () => {
    await expect(
      generateKitDraft(jobDescription, "   ")
    ).rejects.toThrow(
      "Company URL cannot be empty."
    );

    expect(mockedExtractRequirements).not.toHaveBeenCalled();
    expect(mockedResearchCompany).not.toHaveBeenCalled();
    expect(mockedGenerateCompanyBrief).not.toHaveBeenCalled();
    expect(mockedGenerateQuestionPipeline).not.toHaveBeenCalled();
  });

  it("preserves the number of passes used by the question pipeline", async () => {
    mockedExtractRequirements.mockResolvedValue(requirements);

    mockedResearchCompany.mockResolvedValue(research);

    mockedGenerateCompanyBrief.mockResolvedValue(companyBrief);

    mockedGenerateQuestionPipeline.mockResolvedValue({
      questions,
      uncoveredRequirementIds: [],
      passes: 2,
    });

    const result = await generateKitDraft(
      jobDescription,
      companyUrl
    );

    expect(result.coverage.passes).toBe(2);
    expect(result.coverage.uncoveredRequirementIds).toEqual([]);
  });
});