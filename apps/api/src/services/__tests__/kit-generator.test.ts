import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateKitDraft } from "../kit-generator.js";
import type { CompanyBrief } from "../company-brief-generator.js";
import type { GeneratedFlashcard } from "../flashcard-generator.js";
import type { GeneratedQuestion } from "../question-generator.js";
import type { ExtractedRequirement } from "../requirement-extractor.js";
import type { ExtractedRole } from "../role-extractor.js";
import type { GeneratedSchedule } from "../schedule-generator.js";
import type { ResearchResult } from "../researcher.js";

vi.mock("../role-extractor.js", () => ({
  extractRole: vi.fn(),
}));

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

vi.mock("../flashcard-generator.js", () => ({
  generateFlashcards: vi.fn(),
}));

vi.mock("../schedule-generator.js", () => ({
  generateSchedule: vi.fn(),
}));

vi.mock("../kit-validator.js", () => ({
  validateGeneratedKit: vi.fn(),
}));

import { extractRole } from "../role-extractor.js";
import { extractRequirements } from "../requirement-extractor.js";
import { researchCompany } from "../researcher.js";
import { generateCompanyBrief } from "../company-brief-generator.js";
import { generateQuestionPipeline } from "../question-pipeline.js";
import { generateFlashcards } from "../flashcard-generator.js";
import { generateSchedule } from "../schedule-generator.js";
import { validateGeneratedKit } from "../kit-validator.js";

const mockedExtractRole = vi.mocked(extractRole);

const mockedExtractRequirements = vi.mocked(
  extractRequirements
);

const mockedResearchCompany = vi.mocked(
  researchCompany
);

const mockedGenerateCompanyBrief = vi.mocked(
  generateCompanyBrief
);

const mockedGenerateQuestionPipeline = vi.mocked(
  generateQuestionPipeline
);

const mockedGenerateFlashcards = vi.mocked(
  generateFlashcards
);

const mockedGenerateSchedule = vi.mocked(
  generateSchedule
);

const mockedValidateGeneratedKit = vi.mocked(
  validateGeneratedKit
);

const role: ExtractedRole = {
  title: "Software Engineer",
  seniority: "Mid-level",
  responsibilities: [
    "Build and maintain web applications",
    "Collaborate with engineering teams",
  ],
};

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
    answer_outline:
      "Call stack; microtasks; macrotasks",
    difficulty: 2,
  },
  {
    id: "q2",
    requirement_ids: ["r2"],
    category: "technical",
    prompt: "How does React reconciliation work?",
    answer_outline:
      "Virtual DOM; reconciliation; rendering",
    difficulty: 2,
  },
];

const flashcards: GeneratedFlashcard[] = [
  {
    id: "f1",
    front: "What is the JavaScript event loop?",
    back: "It coordinates synchronous code with asynchronous callbacks.",
    requirement_ids: ["r1"],
  },
  {
    id: "f2",
    front: "What is React reconciliation?",
    back: "The process React uses to determine what needs to be updated.",
    requirement_ids: ["r2"],
  },
];

const schedule: GeneratedSchedule = {
  days_available: 5,
  days: [
    {
      day: 1,
      focus: "JavaScript fundamentals",
      question_ids: ["q1"],
      minutes: 8,
    },
    {
      day: 2,
      focus: "React fundamentals",
      question_ids: ["q2"],
      minutes: 8,
    },
    {
      day: 3,
      focus: "Interview practice",
      question_ids: [],
      minutes: 0,
    },
    {
      day: 4,
      focus: "Interview practice",
      question_ids: [],
      minutes: 0,
    },
    {
      day: 5,
      focus: "Interview practice",
      question_ids: [],
      minutes: 0,
    },
  ],
};

const jobDescription =
  "Build a React application using JavaScript.";

const companyUrl = "https://example.com/";

const daysAvailable = 5;

describe("generateKitDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(
    "orchestrates role, requirements, research, company brief, questions, flashcards, schedule, and validation",
    async () => {
      mockedExtractRole.mockResolvedValue(role);

      mockedExtractRequirements.mockResolvedValue(
        requirements
      );

      mockedResearchCompany.mockResolvedValue(
        research
      );

      mockedGenerateCompanyBrief.mockResolvedValue(
        companyBrief
      );

      mockedGenerateQuestionPipeline.mockResolvedValue({
        questions,
        uncoveredRequirementIds: [],
        passes: 1,
      });

      mockedGenerateFlashcards.mockResolvedValue(
        flashcards
      );

      mockedGenerateSchedule.mockReturnValue(
        schedule
      );

      mockedValidateGeneratedKit.mockReturnValue({
        valid: true,
        errors: [],
      });

      const result = await generateKitDraft(
        jobDescription,
        companyUrl,
        daysAvailable
      );

      expect(result.role).toEqual(role);

      expect(result.requirements).toEqual(
        requirements
      );

      expect(result.research).toEqual(research);

      expect(result.companyBrief).toEqual(
        companyBrief
      );

      expect(result.questions).toEqual(
        questions
      );

      expect(result.flashcards).toEqual(
        flashcards
      );

      expect(result.schedule).toEqual(
        schedule
      );

      expect(result.coverage).toEqual({
        uncoveredRequirementIds: [],
        passes: 1,
      });

      expect(mockedExtractRole).toHaveBeenCalledTimes(
        1
      );

      expect(mockedExtractRole).toHaveBeenCalledWith(
        jobDescription
      );

      expect(
        mockedExtractRequirements
      ).toHaveBeenCalledTimes(1);

      expect(
        mockedExtractRequirements
      ).toHaveBeenCalledWith(
        jobDescription
      );

      expect(
        mockedResearchCompany
      ).toHaveBeenCalledTimes(1);

      expect(
        mockedResearchCompany
      ).toHaveBeenCalledWith(
        companyUrl
      );

      expect(
        mockedGenerateCompanyBrief
      ).toHaveBeenCalledTimes(1);

      expect(
        mockedGenerateCompanyBrief
      ).toHaveBeenCalledWith(
        companyUrl,
        research
      );

      expect(
        mockedGenerateQuestionPipeline
      ).toHaveBeenCalledTimes(1);

      expect(
        mockedGenerateQuestionPipeline
      ).toHaveBeenCalledWith(
        requirements,
        {
          companyBrief,
        }
      );

      expect(
        mockedGenerateFlashcards
      ).toHaveBeenCalledTimes(1);

      expect(
        mockedGenerateFlashcards
      ).toHaveBeenCalledWith(
        requirements
      );

      expect(
        mockedGenerateSchedule
      ).toHaveBeenCalledTimes(1);

      expect(
        mockedGenerateSchedule
      ).toHaveBeenCalledWith(
        requirements,
        questions,
        daysAvailable
      );

      expect(
        mockedValidateGeneratedKit
      ).toHaveBeenCalledTimes(1);

      expect(
        mockedValidateGeneratedKit
      ).toHaveBeenCalledWith({
        requirements,
        questions,
        schedule,
      });
    }
  );

  it("rejects an empty job description", async () => {
    await expect(
      generateKitDraft(
        "   ",
        companyUrl,
        daysAvailable
      )
    ).rejects.toThrow(
      "Job description cannot be empty."
    );

    expect(
      mockedExtractRole
    ).not.toHaveBeenCalled();

    expect(
      mockedExtractRequirements
    ).not.toHaveBeenCalled();

    expect(
      mockedResearchCompany
    ).not.toHaveBeenCalled();

    expect(
      mockedGenerateCompanyBrief
    ).not.toHaveBeenCalled();

    expect(
      mockedGenerateQuestionPipeline
    ).not.toHaveBeenCalled();

    expect(
      mockedGenerateFlashcards
    ).not.toHaveBeenCalled();

    expect(
      mockedGenerateSchedule
    ).not.toHaveBeenCalled();

    expect(
      mockedValidateGeneratedKit
    ).not.toHaveBeenCalled();
  });

  it("rejects an empty company URL", async () => {
    await expect(
      generateKitDraft(
        jobDescription,
        "   ",
        daysAvailable
      )
    ).rejects.toThrow(
      "Company URL cannot be empty."
    );

    expect(
      mockedExtractRole
    ).not.toHaveBeenCalled();

    expect(
      mockedExtractRequirements
    ).not.toHaveBeenCalled();

    expect(
      mockedResearchCompany
    ).not.toHaveBeenCalled();

    expect(
      mockedGenerateCompanyBrief
    ).not.toHaveBeenCalled();

    expect(
      mockedGenerateQuestionPipeline
    ).not.toHaveBeenCalled();

    expect(
      mockedGenerateFlashcards
    ).not.toHaveBeenCalled();

    expect(
      mockedGenerateSchedule
    ).not.toHaveBeenCalled();

    expect(
      mockedValidateGeneratedKit
    ).not.toHaveBeenCalled();
  });

  it("rejects an invalid number of days", async () => {
    await expect(
      generateKitDraft(
        jobDescription,
        companyUrl,
        0
      )
    ).rejects.toThrow(
      "daysAvailable must be a positive integer."
    );

    expect(
      mockedExtractRole
    ).not.toHaveBeenCalled();

    expect(
      mockedExtractRequirements
    ).not.toHaveBeenCalled();

    expect(
      mockedResearchCompany
    ).not.toHaveBeenCalled();

    expect(
      mockedGenerateCompanyBrief
    ).not.toHaveBeenCalled();

    expect(
      mockedGenerateQuestionPipeline
    ).not.toHaveBeenCalled();

    expect(
      mockedGenerateFlashcards
    ).not.toHaveBeenCalled();

    expect(
      mockedGenerateSchedule
    ).not.toHaveBeenCalled();

    expect(
      mockedValidateGeneratedKit
    ).not.toHaveBeenCalled();
  });

  it(
    "preserves the number of passes used by the question pipeline",
    async () => {
      mockedExtractRole.mockResolvedValue(role);

      mockedExtractRequirements.mockResolvedValue(
        requirements
      );

      mockedResearchCompany.mockResolvedValue(
        research
      );

      mockedGenerateCompanyBrief.mockResolvedValue(
        companyBrief
      );

      mockedGenerateQuestionPipeline.mockResolvedValue({
        questions,
        uncoveredRequirementIds: [],
        passes: 2,
      });

      mockedGenerateFlashcards.mockResolvedValue(
        flashcards
      );

      mockedGenerateSchedule.mockReturnValue(
        schedule
      );

      mockedValidateGeneratedKit.mockReturnValue({
        valid: true,
        errors: [],
      });

      const result = await generateKitDraft(
        jobDescription,
        companyUrl,
        daysAvailable
      );

      expect(
        result.coverage.passes
      ).toBe(2);

      expect(
        result.coverage.uncoveredRequirementIds
      ).toEqual([]);

      expect(result.schedule).toEqual(
        schedule
      );
    }
  );

  it(
    "rejects the generated kit when final validation fails",
    async () => {
      mockedExtractRole.mockResolvedValue(role);

      mockedExtractRequirements.mockResolvedValue(
        requirements
      );

      mockedResearchCompany.mockResolvedValue(
        research
      );

      mockedGenerateCompanyBrief.mockResolvedValue(
        companyBrief
      );

      mockedGenerateQuestionPipeline.mockResolvedValue({
        questions,
        uncoveredRequirementIds: [],
        passes: 1,
      });

      mockedGenerateFlashcards.mockResolvedValue(
        flashcards
      );

      mockedGenerateSchedule.mockReturnValue(
        schedule
      );

      mockedValidateGeneratedKit.mockReturnValue({
        valid: false,
        errors: [
          "Must-have requirement r2 is not covered by any question.",
        ],
      });

      await expect(
        generateKitDraft(
          jobDescription,
          companyUrl,
          daysAvailable
        )
      ).rejects.toThrow(
        "Generated kit validation failed: Must-have requirement r2 is not covered by any question."
      );

      expect(
        mockedValidateGeneratedKit
      ).toHaveBeenCalledWith({
        requirements,
        questions,
        schedule,
      });
    }
  );
});