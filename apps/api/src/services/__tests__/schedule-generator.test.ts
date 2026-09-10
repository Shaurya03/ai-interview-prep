import { describe, expect, it } from "vitest";
import { generateSchedule } from "../schedule-generator.js";
import type { ExtractedRequirement } from "../requirement-extractor.js";
import type { GeneratedQuestion } from "../question-generator.js";

const requirements: ExtractedRequirement[] = [
  {
    id: "r1",
    text: "React",
    kind: "technical",
    priority: "must",
  },
  {
    id: "r2",
    text: "Node.js",
    kind: "technical",
    priority: "must",
  },
  {
    id: "r3",
    text: "Docker",
    kind: "technical",
    priority: "nice",
  },
];

const questions: GeneratedQuestion[] = [
  {
    id: "q1",
    requirement_ids: ["r1"],
    category: "technical",
    prompt: "Explain how React rendering works.",
    answer_outline: "Discuss components, state, reconciliation, and rendering.",
    difficulty: 3,
  },
  {
    id: "q2",
    requirement_ids: ["r2"],
    category: "technical",
    prompt: "How would you design a Node.js REST API?",
    answer_outline: "Discuss routing, validation, errors, and persistence.",
    difficulty: 3,
  },
  {
    id: "q3",
    requirement_ids: ["r3"],
    category: "technical",
    prompt: "Why would you use Docker?",
    answer_outline: "Discuss isolation, reproducibility, and deployment.",
    difficulty: 1,
  },
  {
    id: "q4",
    requirement_ids: ["r1", "r2"],
    category: "system-design",
    prompt: "How would React communicate with a Node.js backend?",
    answer_outline: "Discuss HTTP, APIs, validation, and error handling.",
    difficulty: 2,
  },
];

describe("generateSchedule", () => {
  it("creates exactly the requested number of days", () => {
    const schedule = generateSchedule(requirements, questions, 5);

    expect(schedule.days_available).toBe(5);
    expect(schedule.days).toHaveLength(5);
  });

  it("schedules every question exactly once", () => {
    const schedule = generateSchedule(requirements, questions, 3);

    const scheduledQuestionIds = schedule.days.flatMap(
      (day) => day.question_ids
    );

    expect(scheduledQuestionIds).toHaveLength(questions.length);
    expect(new Set(scheduledQuestionIds).size).toBe(questions.length);

    expect(scheduledQuestionIds.sort()).toEqual(
      questions.map((question) => question.id).sort()
    );
  });

  it("ensures must-have requirements are covered", () => {
    const schedule = generateSchedule(requirements, questions, 3);

    const scheduledQuestionIds = new Set(
      schedule.days.flatMap((day) => day.question_ids)
    );

    const scheduledQuestions = questions.filter((question) =>
      scheduledQuestionIds.has(question.id)
    );

    const coveredRequirementIds = new Set(
      scheduledQuestions.flatMap((question) => question.requirement_ids)
    );

    expect(coveredRequirementIds.has("r1")).toBe(true);
    expect(coveredRequirementIds.has("r2")).toBe(true);
  });

  it("calculates minutes from question difficulty", () => {
    const schedule = generateSchedule(requirements, questions, 1);

    expect(schedule.days[0].minutes).toBe(12 + 12 + 5 + 8);
  });
});