import { generateCompanyBrief } from "./company-brief-generator.js";
import { generateQuestionPipeline } from "./question-pipeline.js";
import { extractRequirements } from "./requirement-extractor.js";
import { researchCompany } from "./researcher.js";

export interface GeneratedKitDraft {
  requirements: Awaited<ReturnType<typeof extractRequirements>>;
  research: Awaited<ReturnType<typeof researchCompany>>;
  companyBrief: Awaited<ReturnType<typeof generateCompanyBrief>>;
  questions: Awaited<
    ReturnType<typeof generateQuestionPipeline>
  >["questions"];
  coverage: {
    uncoveredRequirementIds: string[];
    passes: number;
  };
}

export async function generateKitDraft(
  jobDescription: string,
  companyUrl: string
): Promise<GeneratedKitDraft> {
  if (!jobDescription.trim()) {
    throw new Error("Job description cannot be empty.");
  }

  if (!companyUrl.trim()) {
    throw new Error("Company URL cannot be empty.");
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

  // Step 4: Generate questions and repair uncovered must-have
  // requirements through the question pipeline.
  const questionResult = await generateQuestionPipeline(
    requirements
  );

  return {
    requirements,
    research,
    companyBrief,
    questions: questionResult.questions,
    coverage: {
      uncoveredRequirementIds:
        questionResult.uncoveredRequirementIds,
      passes: questionResult.passes,
    },
  };
}