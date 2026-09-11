import dotenv from "dotenv";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateKitDraft } from "./services/kit-generator.js";
import {
  kitSchema,
  type InterviewKit,
} from "../../../packages/shared/src/kit.js";

// The evaluator is run from the repository root, so load the root .env file.
dotenv.config({
  path: resolve(process.cwd(), ".env"),
});

interface EvaluationCase {
  id: string;
  jd: string;
  company_url: string;
  days: number;
}

interface EvaluationInput {
  cases: EvaluationCase[];
}

interface EvaluationError {
  code: string;
  message: string;
}

interface EvaluationSuccess {
  id: string;
  status: "ok";
  kit: InterviewKit;
  error: null;
}

interface EvaluationFailure {
  id: string;
  status: "failed";
  kit: null;
  error: EvaluationError;
}

type EvaluationResult = EvaluationSuccess | EvaluationFailure;

interface EvaluationOutput {
  version: "1.0";
  generated_at: string;
  kits: EvaluationResult[];
}

function printUsage(): void {
  console.error(
    "Usage: npm run evaluate -- --input <cases.json> --output <kits.json>"
  );
}

function getArgument(name: string): string | undefined {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function parseInputFile(inputPath: string): EvaluationInput {
  if (!existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const raw = readFileSync(inputPath, "utf8");

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Input file is not valid JSON: ${inputPath}`);
  }

  const cases = Array.isArray(parsed)
    ? parsed
    : (
      parsed as {
        cases?: unknown;
      }
    )?.cases;

  if (!Array.isArray(cases)) {
    throw new Error(
      'Input JSON must be an array of cases or an object containing a "cases" array.'
    );
  }

  const normalizedCases: EvaluationCase[] = [];

  for (let index = 0; index < cases.length; index += 1) {
    const candidate = cases[index];

    if (!candidate || typeof candidate !== "object") {
      throw new Error(`Case ${index + 1} must be an object.`);
    }

    const value = candidate as Record<string, unknown>;

    if (typeof value.id !== "string" || !value.id.trim()) {
      throw new Error(`Case ${index + 1} has an invalid "id".`);
    }

    if (typeof value.jd !== "string" || !value.jd.trim()) {
      throw new Error(`Case ${index + 1} has an invalid "jd".`);
    }

    if (
      typeof value.company_url !== "string" ||
      !value.company_url.trim()
    ) {
      throw new Error(
        `Case ${index + 1} has an invalid "company_url".`
      );
    }

    if (
      typeof value.days !== "number" ||
      !Number.isInteger(value.days) ||
      value.days < 1
    ) {
      throw new Error(
        `Case ${index + 1} has an invalid "days" value. It must be a positive integer.`
      );
    }

    normalizedCases.push({
      id: value.id.trim(),
      jd: value.jd,
      company_url: value.company_url.trim(),
      days: value.days,
    });
  }

  return {
    cases: normalizedCases,
  };
}

function buildInterviewKit(
  evaluationCase: EvaluationCase,
  draft: Awaited<ReturnType<typeof generateKitDraft>>
): InterviewKit {
  const kit = {
    source: {
      company: draft.role.company,
      company_url: evaluationCase.company_url,
      role: draft.role.title,
      location: draft.role.location,
      jd_chars: evaluationCase.jd.length,
      researched_at: new Date().toISOString(),
      pages_used: draft.research.pagesUsed,
    },

    company_brief: draft.companyBrief,

    role: {
      title: draft.role.title,
      seniority: draft.role.seniority,
      responsibilities: draft.role.responsibilities,
      requirements: draft.requirements,
    },

    questions: draft.questions,

    flashcards: draft.flashcards,

    schedule: draft.schedule,

    coverage: {
      uncovered_requirement_ids:
        draft.coverage.uncoveredRequirementIds,
      passes: draft.coverage.passes,
    },
  };

  return kitSchema.parse(kit);
}

function getEvaluationError(error: unknown): EvaluationError {
  if (error instanceof Error) {
    const possibleError = error as Error & {
      code?: unknown;
    };

    if (
      typeof possibleError.code === "string" &&
      possibleError.code.trim()
    ) {
      return {
        code: possibleError.code,
        message: error.message,
      };
    }

    return {
      code: "GENERATION_FAILED",
      message: error.message,
    };
  }

  return {
    code: "GENERATION_FAILED",
    message: "Unknown generation error.",
  };
}

async function evaluateCase(
  evaluationCase: EvaluationCase
): Promise<EvaluationResult> {
  try {
    const draft = await generateKitDraft(
      evaluationCase.jd,
      evaluationCase.company_url,
      evaluationCase.days
    );

    const kit = buildInterviewKit(evaluationCase, draft);

    return {
      id: evaluationCase.id,
      status: "ok",
      kit,
      error: null,
    };
  } catch (error) {
    const evaluationError = getEvaluationError(error);

    return {
      id: evaluationCase.id,
      status: "failed",
      kit: null,
      error: evaluationError,
    };
  }
}

async function main(): Promise<void> {
  const inputArgument = getArgument("--input");
  const outputArgument = getArgument("--output");

  if (!inputArgument || !outputArgument) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const inputPath = resolve(process.cwd(), inputArgument);
  const outputPath = resolve(process.cwd(), outputArgument);

  let input: EvaluationInput;

  try {
    input = parseInputFile(inputPath);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to read evaluation input.";

    console.error(message);
    process.exitCode = 1;
    return;
  }

  const results: EvaluationResult[] = [];

  for (const evaluationCase of input.cases) {
    console.log(`Evaluating case: ${evaluationCase.id}`);

    const result = await evaluateCase(evaluationCase);

    results.push(result);

    if (result.status === "ok") {
      console.log(`✓ ${evaluationCase.id}`);
    } else {
      console.error(
        `✗ ${evaluationCase.id}: ` +
        `[${result.error.code}] ${result.error.message}`
      );
    }
  }

  const output: EvaluationOutput = {
    version: "1.0",
    generated_at: new Date().toISOString(),
    kits: results,
  };

  writeFileSync(
    outputPath,
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8"
  );

  const successful = results.filter(
    (result) => result.status === "ok"
  ).length;

  const failed = results.length - successful;

  console.log(
    `Evaluation complete: ${successful} succeeded, ${failed} failed.`
  );

  console.log(`Output written to: ${outputPath}`);
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Unexpected evaluator error."
  );

  process.exitCode = 1;
});