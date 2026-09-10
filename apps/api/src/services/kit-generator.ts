import { generateCompanyBrief } from "./company-brief-generator.js";
import { generateQuestionPipeline } from "./question-pipeline.js";
import { extractRequirements } from "./requirement-extractor.js";
import { researchCompany } from "./researcher.js";
import { generateSchedule } from "./schedule-generator.js";
import { validateGeneratedKit } from "./kit-validator.js";

export interface GeneratedKitDraft {
  requirements: Awaited<ReturnType<typeof extractRequirements>>;
  research: Awaited<ReturnType<typeof researchCompany>>;
  companyBrief: Awaited<ReturnType<typeof generateCompanyBrief>>;
  questions: Awaited<
    ReturnType<typeof generateQuestionPipeline>
  >["questions"];
  schedule: Awaited<ReturnType<typeof generateSchedule>>;
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
  const research = await researchCompany(companyUrl);

  // Step 3: Generate a company brief from the retrieved research.
  const companyBrief = await generateCompanyBrief(
    companyUrl,
    research
  );

  // Step 4: Generate questions using the requirements and
  // company-specific context.
  const questionResult = await generateQuestionPipeline(
    requirements,
    {
      companyBrief,
    }
  );

  // Step 5: Generate a deterministic preparation schedule.
  const schedule = generateSchedule(
    requirements,
    questionResult.questions,
    daysAvailable
  );

  // Step 6: Validate the complete generated kit before it can
  // be persisted or marked as ready.
  const validation = validateGeneratedKit({
    requirements,
    questions: questionResult.questions,
    schedule,
  });

  if (!validation.valid) {
    throw new Error(
      `Generated kit validation failed: ${validation.errors.join(" ")}`
    );
  }

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