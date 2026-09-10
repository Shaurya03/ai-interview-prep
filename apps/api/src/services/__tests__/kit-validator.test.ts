import { describe, expect, it } from "vitest";

import {
  validateGeneratedKit,
  type KitValidationInput,
} from "../kit-validator.js";

const requirements: KitValidationInput["requirements"] = [
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
  {
    id: "r3",
    text: "Docker experience",
    kind: "technical",
    priority: "nice",
  },
];

const questions: KitValidationInput["questions"] = [
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
  {
    id: "q3",
    requirement_ids: ["r1", "r2"],
    category: "system-design",
    prompt:
      "How would you design a React application that consumes a JavaScript API?",
    answer_outline:
      "Component structure; API layer; state management; error handling",
    difficulty: 3,
  },
];

const schedule: KitValidationInput["schedule"] = {
  days_available: 2,
  days: [
    {
      day: 1,
      focus: "JavaScript fundamentals",
      question_ids: ["q1", "q3"],
      minutes: 20,
    },
    {
      day: 2,
      focus: "React",
      question_ids: ["q2"],
      minutes: 8,
    },
  ],
};

describe("validateGeneratedKit", () => {
  it("accepts a valid generated kit", () => {
    const result = validateGeneratedKit({
      requirements,
      questions,
      schedule,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects a question that references an unknown requirement", () => {
    const invalidQuestions = [
      ...questions,
      {
        id: "q4",
        requirement_ids: ["r999"],
        category: "technical" as const,
        prompt: "Invalid question",
        answer_outline: "Invalid requirement reference",
        difficulty: 1,
      },
    ];

    const result = validateGeneratedKit({
      requirements,
      questions: invalidQuestions,
      schedule,
    });

    expect(result.valid).toBe(false);

    expect(result.errors).toContain(
      "Question q4 references unknown requirement: r999."
    );
  });

  it("rejects an uncovered must-have requirement", () => {
    const incompleteQuestions = questions.map((question) => {
      if (question.id === "q2") {
        return {
          ...question,
          requirement_ids: ["r1"],
        };
      }

      if (question.id === "q3") {
        return {
          ...question,
          requirement_ids: ["r1"],
        };
      }

      return question;
    });

    const incompleteSchedule = {
      ...schedule,
      days: [
        {
          ...schedule.days[0],
          question_ids: ["q1", "q3"],
        },
        {
          ...schedule.days[1],
          question_ids: [],
        },
      ],
    };

    const result = validateGeneratedKit({
      requirements,
      questions: incompleteQuestions,
      schedule: incompleteSchedule,
    });

    expect(result.valid).toBe(false);

    expect(result.errors).toContain(
      "Must-have requirement r2 is not covered by any question."
    );

    expect(result.errors).toContain(
      "Question q2 is not included in the schedule."
    );
  });

  it("rejects a schedule with the wrong number of days", () => {
    const invalidSchedule = {
      ...schedule,
      days_available: 3,
    };

    const result = validateGeneratedKit({
      requirements,
      questions,
      schedule: invalidSchedule,
    });

    expect(result.valid).toBe(false);

    expect(result.errors).toContain(
      "Schedule must contain exactly 3 days."
    );
  });

  it("rejects a schedule that references an unknown question", () => {
    const invalidSchedule = {
      ...schedule,
      days: [
        {
          ...schedule.days[0],
          question_ids: ["q1", "q999"],
        },
        schedule.days[1],
      ],
    };

    const result = validateGeneratedKit({
      requirements,
      questions,
      schedule: invalidSchedule,
    });

    expect(result.valid).toBe(false);

    expect(result.errors).toContain(
      "Schedule day 1 references unknown question: q999."
    );
  });

  it("rejects duplicate requirement IDs", () => {
    const invalidRequirements = [
      ...requirements,
      {
        id: "r1",
        text: "Another requirement",
        kind: "technical" as const,
        priority: "nice" as const,
      },
    ];

    const result = validateGeneratedKit({
      requirements: invalidRequirements,
      questions,
      schedule,
    });

    expect(result.valid).toBe(false);

    expect(result.errors).toContain(
      "Duplicate requirement ID: r1"
    );
  });
});