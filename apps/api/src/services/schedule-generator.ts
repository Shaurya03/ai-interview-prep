import type { ExtractedRequirement } from "./requirement-extractor.js";
import type { GeneratedQuestion } from "./question-generator.js";

export interface GeneratedScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

export interface GeneratedSchedule {
  days_available: number;
  days: GeneratedScheduleDay[];
}

function estimateQuestionMinutes(difficulty: number): number {
  if (difficulty === 1) {
    return 5;
  }

  if (difficulty === 2) {
    return 8;
  }

  return 12;
}

function getQuestionPriority(
  question: GeneratedQuestion,
  requirementsById: Map<string, ExtractedRequirement>
): number {
  const priorities = question.requirement_ids
    .map((id) => requirementsById.get(id)?.priority)
    .filter(Boolean);

  return priorities.includes("must") ? 2 : 1;
}

function getQuestionDifficulty(question: GeneratedQuestion): number {
  return question.difficulty;
}

function buildFocus(
  questions: GeneratedQuestion[],
  requirementsById: Map<string, ExtractedRequirement>
): string {
  const requirementTexts = questions
    .flatMap((question) =>
      question.requirement_ids
        .map((id) => requirementsById.get(id)?.text)
        .filter((text): text is string => Boolean(text))
    )
    .slice(0, 3);

  if (requirementTexts.length === 0) {
    return "Interview practice";
  }

  return requirementTexts.join(" • ");
}

export function generateSchedule(
  requirements: ExtractedRequirement[],
  questions: GeneratedQuestion[],
  daysAvailable: number
): GeneratedSchedule {
  if (!Number.isInteger(daysAvailable) || daysAvailable < 1) {
    throw new Error("daysAvailable must be a positive integer.");
  }

  if (requirements.length === 0) {
    throw new Error("Cannot generate a schedule without requirements.");
  }

  if (questions.length === 0) {
    throw new Error("Cannot generate a schedule without questions.");
  }

  const requirementsById = new Map(
    requirements.map((requirement) => [requirement.id, requirement])
  );

  // Questions that cover must-have requirements come first.
  // Within that group, harder questions come first.
  const sortedQuestions = [...questions].sort((a, b) => {
    const priorityDifference =
      getQuestionPriority(b, requirementsById) -
      getQuestionPriority(a, requirementsById);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return getQuestionDifficulty(b) - getQuestionDifficulty(a);
  });

  const days: GeneratedScheduleDay[] = Array.from(
    { length: daysAvailable },
    (_, index) => ({
      day: index + 1,
      focus: "Interview practice",
      question_ids: [],
      minutes: 0,
    })
  );

  /*
   * Distribute questions across the requested number of days.
   *
   * We use a balanced sequential distribution rather than random
   * assignment. Because questions are already sorted by priority
   * and difficulty, earlier days naturally receive more important
   * and harder questions.
   */
  sortedQuestions.forEach((question, index) => {
    const dayIndex = Math.min(
      Math.floor((index * daysAvailable) / sortedQuestions.length),
      daysAvailable - 1
    );

    const day = days[dayIndex];

    day.question_ids.push(question.id);
    day.minutes += estimateQuestionMinutes(question.difficulty);
  });

  for (const day of days) {
    const dayQuestions = day.question_ids
      .map((questionId) =>
        questions.find((question) => question.id === questionId)
      )
      .filter((question): question is GeneratedQuestion => Boolean(question));

    day.focus = buildFocus(dayQuestions, requirementsById);
  }

  // Defensive validation:
  // every must-have requirement must appear in at least one scheduled question.
  const scheduledQuestionIds = new Set(
    days.flatMap((day) => day.question_ids)
  );

  const scheduledQuestions = questions.filter((question) =>
    scheduledQuestionIds.has(question.id)
  );

  const coveredRequirementIds = new Set(
    scheduledQuestions.flatMap((question) => question.requirement_ids)
  );

  const uncoveredMustRequirements = requirements
    .filter(
      (requirement) =>
        requirement.priority === "must" &&
        !coveredRequirementIds.has(requirement.id)
    )
    .map((requirement) => requirement.id);

  if (uncoveredMustRequirements.length > 0) {
    throw new Error(
      `Schedule left must-have requirements uncovered: ${uncoveredMustRequirements.join(", ")}`
    );
  }

  return {
    days_available: daysAvailable,
    days,
  };
}