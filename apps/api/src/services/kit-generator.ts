import { generateCompanyBrief } from "./company-brief-generator.js";
import { generateFlashcards } from "./flashcard-generator.js";
import { generateQuestionPipeline } from "./question-pipeline.js";
import { extractRequirements } from "./requirement-extractor.js";
import { extractRole } from "./role-extractor.js";
import { researchCompany } from "./researcher.js";
import { generateSchedule } from "./schedule-generator.js";
import { validateGeneratedKit } from "./kit-validator.js";

const MAX_ROLE_EXTRACTION_ATTEMPTS = 2;

export interface GeneratedKitDraft {
  role: Awaited<ReturnType<typeof extractRole>>;
  requirements: Awaited<ReturnType<typeof extractRequirements>>;
  research: Awaited<ReturnType<typeof researchCompany>>;
  companyBrief: Awaited<ReturnType<typeof generateCompanyBrief>>;
  questions: Awaited<
    ReturnType<typeof generateQuestionPipeline>
  >["questions"];
  flashcards: Awaited<ReturnType<typeof generateFlashcards>>;
  schedule: Awaited<ReturnType<typeof generateSchedule>>;
  coverage: {
    uncoveredRequirementIds: string[];
    passes: number;
  };
}

function isCompleteRole(
  role: Awaited<ReturnType<typeof extractRole>>
): boolean {
  return (
    typeof role.title === "string" &&
    role.title.trim().length > 0 &&
    typeof role.seniority === "string" &&
    role.seniority.trim().length > 0 &&
    Array.isArray(role.responsibilities) &&
    role.responsibilities.some(
      (responsibility) =>
        typeof responsibility === "string" &&
        responsibility.trim().length > 0
    )
  );
}

async function extractRoleWithRetry(
  jobDescription: string
): Promise<Awaited<ReturnType<typeof extractRole>>> {
  let lastRole: Awaited<ReturnType<typeof extractRole>> | null = null;

  for (
    let attempt = 1;
    attempt <= MAX_ROLE_EXTRACTION_ATTEMPTS;
    attempt++
  ) {
    const role = await extractRole(jobDescription);
    lastRole = role;

    if (isCompleteRole(role)) {
      return role;
    }

    if (attempt < MAX_ROLE_EXTRACTION_ATTEMPTS) {
      console.log(
        `Role extraction returned incomplete data. Retrying (${attempt + 1}/${MAX_ROLE_EXTRACTION_ATTEMPTS})...`
      );
    }
  }

  throw new Error(
    `Role extraction returned incomplete data after ${MAX_ROLE_EXTRACTION_ATTEMPTS} attempts.`
  );
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

  // Step 1: Extract role information from the job description.
  // The LLM can return valid JSON that is still structurally incomplete,
  // so retry once before treating role extraction as a failure.
  const role = await extractRoleWithRetry(jobDescription);

  // Step 2: Extract explicit requirements from the job description.
  const requirements = await extractRequirements(jobDescription);

  // Step 3: Research the company website.
  const research = await researchCompany(companyUrl);

  // Step 4: Generate a company brief from the retrieved research.
  const companyBrief = await generateCompanyBrief(
    companyUrl,
    research
  );

  // Step 5: Generate questions using the requirements and
  // company-specific context.
  const questionResult = await generateQuestionPipeline(
    requirements,
    {
      companyBrief,
    }
  );

  // Step 6: Generate flashcards from the extracted requirements.
  const flashcards = await generateFlashcards(requirements);

  // Step 7: Generate a deterministic preparation schedule.
  const schedule = generateSchedule(
    requirements,
    questionResult.questions,
    daysAvailable
  );

  // Step 8: Validate the complete generated kit before it can
  // be persisted or marked as ready.
  const validation = validateGeneratedKit({
    role,
    requirements,
    questions: questionResult.questions,
    flashcards,
    schedule,
  });

  if (!validation.valid) {
    throw new Error(
      `Generated kit validation failed: ${validation.errors.join(" ")}`
    );
  }

  return {
    role,
    requirements,
    research,
    companyBrief,
    questions: questionResult.questions,
    flashcards,
    schedule,
    coverage: {
      uncoveredRequirementIds:
        questionResult.uncoveredRequirementIds,
      passes: questionResult.passes,
    },
  };
}