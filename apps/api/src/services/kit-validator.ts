import type { ExtractedRequirement } from "./requirement-extractor.js";
import type { GeneratedQuestion } from "./question-generator.js";
import type { GeneratedSchedule } from "./schedule-generator.js";

export interface KitValidationInput {
  role: {
    title: string;
    seniority: string;
    responsibilities: string[];
  };

  requirements: ExtractedRequirement[];

  questions: GeneratedQuestion[];

  flashcards: {
    id: string;
    front: string;
    back: string;
    requirement_ids: string[];
  }[];

  schedule: GeneratedSchedule;
}

export interface KitValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateGeneratedKit(
  input: KitValidationInput
): KitValidationResult {
  const errors: string[] = [];

  const {
    role,
    requirements,
    questions,
    flashcards,
    schedule,
  } = input;

  // --------------------------------------------------
  // Role
  // --------------------------------------------------

  if (!role.title.trim()) {
    errors.push("Role must have a title.");
  }

  if (!role.seniority.trim()) {
    errors.push("Role must have a seniority level.");
  }

  if (role.responsibilities.length === 0) {
    errors.push(
      "Role must contain at least one responsibility."
    );
  }

  for (const responsibility of role.responsibilities) {
    if (!responsibility.trim()) {
      errors.push(
        "Role responsibilities must not contain empty values."
      );
    }
  }

  // --------------------------------------------------
  // Requirements
  // --------------------------------------------------

  if (requirements.length === 0) {
    errors.push("Kit must contain at least one requirement.");
  }

  const requirementIds = new Set<string>();

  for (const requirement of requirements) {
    if (!requirement.id.trim()) {
      errors.push("Every requirement must have an ID.");
      continue;
    }

    if (requirementIds.has(requirement.id)) {
      errors.push(
        `Duplicate requirement ID: ${requirement.id}`
      );
    }

    requirementIds.add(requirement.id);

    if (!requirement.text.trim()) {
      errors.push(
        `Requirement ${requirement.id} must have text.`
      );
    }
  }

  // --------------------------------------------------
  // Questions
  // --------------------------------------------------

  if (questions.length === 0) {
    errors.push("Kit must contain at least one question.");
  }

  const questionIds = new Set<string>();

  const allowedCategories = new Set([
    "technical",
    "behavioural",
    "system-design",
    "company-fit",
  ]);

  for (const question of questions) {
    if (!question.id.trim()) {
      errors.push("Every question must have an ID.");
      continue;
    }

    if (questionIds.has(question.id)) {
      errors.push(
        `Duplicate question ID: ${question.id}`
      );
    }

    questionIds.add(question.id);

    if (!question.prompt.trim()) {
      errors.push(
        `Question ${question.id} must have a prompt.`
      );
    }

    if (!question.answer_outline.trim()) {
      errors.push(
        `Question ${question.id} must have an answer outline.`
      );
    }

    if (!allowedCategories.has(question.category)) {
      errors.push(
        `Question ${question.id} has an invalid category: ${question.category}.`
      );
    }

    if (
      !Number.isInteger(question.difficulty) ||
      question.difficulty < 1 ||
      question.difficulty > 3
    ) {
      errors.push(
        `Question ${question.id} must have difficulty between 1 and 3.`
      );
    }

    if (question.requirement_ids.length === 0) {
      errors.push(
        `Question ${question.id} must reference at least one requirement.`
      );
    }

    for (const requirementId of question.requirement_ids) {
      if (!requirementIds.has(requirementId)) {
        errors.push(
          `Question ${question.id} references unknown requirement: ${requirementId}.`
        );
      }
    }
  }

  // --------------------------------------------------
  // Must-have coverage
  // --------------------------------------------------

  const coveredRequirementIds = new Set(
    questions.flatMap(
      (question) => question.requirement_ids
    )
  );

  for (const requirement of requirements) {
    if (
      requirement.priority === "must" &&
      !coveredRequirementIds.has(requirement.id)
    ) {
      errors.push(
        `Must-have requirement ${requirement.id} is not covered by any question.`
      );
    }
  }

  // --------------------------------------------------
  // Flashcards
  // --------------------------------------------------

  if (flashcards.length === 0) {
    errors.push("Kit must contain at least one flashcard.");
  }

  const flashcardIds = new Set<string>();

  for (const flashcard of flashcards) {
    if (!flashcard.id.trim()) {
      errors.push("Every flashcard must have an ID.");
      continue;
    }

    if (flashcardIds.has(flashcard.id)) {
      errors.push(
        `Duplicate flashcard ID: ${flashcard.id}`
      );
    }

    flashcardIds.add(flashcard.id);

    if (!flashcard.front.trim()) {
      errors.push(
        `Flashcard ${flashcard.id} must have a front.`
      );
    }

    if (!flashcard.back.trim()) {
      errors.push(
        `Flashcard ${flashcard.id} must have a back.`
      );
    }

    if (flashcard.requirement_ids.length === 0) {
      errors.push(
        `Flashcard ${flashcard.id} must reference at least one requirement.`
      );
    }

    for (const requirementId of flashcard.requirement_ids) {
      if (!requirementIds.has(requirementId)) {
        errors.push(
          `Flashcard ${flashcard.id} references unknown requirement: ${requirementId}.`
        );
      }
    }
  }

  // --------------------------------------------------
  // Schedule
  // --------------------------------------------------

  if (
    !Number.isInteger(schedule.days_available) ||
    schedule.days_available < 1
  ) {
    errors.push(
      "Schedule must have a positive number of available days."
    );
  }

  if (
    schedule.days.length !== schedule.days_available
  ) {
    errors.push(
      `Schedule must contain exactly ${schedule.days_available} days.`
    );
  }

  const scheduledQuestionIds = new Set<string>();

  for (const day of schedule.days) {
    if (
      !Number.isInteger(day.day) ||
      day.day < 1 ||
      day.day > schedule.days_available
    ) {
      errors.push(
        `Schedule contains an invalid day number: ${day.day}.`
      );
    }

    if (!day.focus.trim()) {
      errors.push(
        `Schedule day ${day.day} must have a focus.`
      );
    }

    if (
      !Number.isFinite(day.minutes) ||
      day.minutes < 0
    ) {
      errors.push(
        `Schedule day ${day.day} has invalid minutes.`
      );
    }

    for (const questionId of day.question_ids) {
      if (!questionIds.has(questionId)) {
        errors.push(
          `Schedule day ${day.day} references unknown question: ${questionId}.`
        );
      }

      if (scheduledQuestionIds.has(questionId)) {
        errors.push(
          `Question ${questionId} appears in the schedule more than once.`
        );
      }

      scheduledQuestionIds.add(questionId);
    }
  }

  // --------------------------------------------------
  // Every question must be scheduled
  // --------------------------------------------------

  for (const question of questions) {
    if (!scheduledQuestionIds.has(question.id)) {
      errors.push(
        `Question ${question.id} is not included in the schedule.`
      );
    }
  }

  // --------------------------------------------------
  // Must-have requirements must appear in scheduled
  // questions
  // --------------------------------------------------

  const scheduledQuestions = questions.filter(
    (question) => scheduledQuestionIds.has(question.id)
  );

  const scheduledCoveredRequirementIds = new Set(
    scheduledQuestions.flatMap(
      (question) => question.requirement_ids
    )
  );

  for (const requirement of requirements) {
    if (
      requirement.priority === "must" &&
      !scheduledCoveredRequirementIds.has(requirement.id)
    ) {
      errors.push(
        `Must-have requirement ${requirement.id} is not represented in the schedule.`
      );
    }
  }

  // --------------------------------------------------
  // Result
  // --------------------------------------------------

  return {
    valid: errors.length === 0,
    errors,
  };
}