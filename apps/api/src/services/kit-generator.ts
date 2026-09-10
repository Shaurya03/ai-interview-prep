import { generateCompanyBrief } from "./company-brief-generator.js";
import { generateQuestionPipeline } from "./question-pipeline.js";
import { extractRequirements } from "./requirement-extractor.js";
import { researchCompany } from "./researcher.js";
import { generateSchedule } from "./schedule-generator.js";

export interface GeneratedKitDraft {
  requirements: Awaited<ReturnType<typeof extractRequirements>>;
  research: Awaited<ReturnType<typeof researchCompany>>;
  companyBrief: Awaited<ReturnType<typeof generateCompanyBrief>>;
  questions: Awaited<
    ReturnType<typeof generateQuestionPipeline>
  >["questions"];
  schedule: ReturnType<typeof generateSchedule>;
  coverage: {
    uncoveredRequirementIds: string[];
    passes: number;
  };
}

export async function generateKitDraft(
  jobDescription: string,
  companyUrl: string,
  daysAvailable: number
): Promise<GeneratedKitDraft> {
  if (!jobDescription.trim()) {
    throw new Error("Job description cannot be empty.");
  }

  if (!companyUrl.trim()) {
    throw new Error("Company URL cannot be empty.");
  }

  if (!Number.isInteger(daysAvailable) || daysAvailable < 1) {
    throw new Error("daysAvailable must be a positive integer.");
  }

  // Step 1: Extract explicit requirements from the job description.
  const requirements = await extractRequirements(jobDescription);

  // Step 2: Research the company website.
  //
  // The researcher handles URL validation, crawling, cleaning,
  // ranking useful links, and recording research gaps.
  const research = await researchCompany(companyUrl);

  // Step 3: Generate a company brief from the retrieved pages.
  //
  // The brief generator only receives retrieved research rather
  // than arbitrary model-generated web content.
  const companyBrief = await generateCompanyBrief(
    companyUrl,
    research
  );

  // Step 4: Generate questions using both the requirements
  // and the company research context.
  //
  // This allows company-specific information to influence
  // question generation while keeping the requirements grounded
  // in the original job description.
  const questionResult = await generateQuestionPipeline(
    requirements,
    {
      companyBrief,
    }
  );

  // Step 5: Build the preparation schedule deterministically.
  //
  // No LLM is used here. The schedule generator uses the requested
  // number of days plus question priority and difficulty.
  const schedule = generateSchedule(
    requirements,
    questionResult.questions,
    daysAvailable
  );

  return {
    requirements,
    research,
    companyBrief,
    questions: questionResult.questions,
    schedule,
    coverage: {
      uncoveredRequirementIds:
        questionResult.uncoveredRequirementIds,
      passes: questionResult.passes,
    },
  };
}