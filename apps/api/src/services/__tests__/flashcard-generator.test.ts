import { describe, expect, it, vi } from "vitest";

import {
  generateFlashcards,
  type GeneratedFlashcard,
} from "../flashcard-generator.js";

vi.mock("../llm.js", () => ({
  generateJson: vi.fn(),
}));

import { generateJson } from "../llm.js";

const mockedGenerateJson = vi.mocked(generateJson);

const requirements = [
  {
    id: "r1",
    text: "Strong JavaScript fundamentals",
    kind: "technical" as const,
    priority: "must" as const,
  },
  {
    id: "r2",
    text: "Experience with React",
    kind: "technical" as const,
    priority: "must" as const,
  },
  {
    id: "r3",
    text: "Docker experience",
    kind: "technical" as const,
    priority: "nice" as const,
  },
];

describe("generateFlashcards", () => {
  it("generates flashcards with stable IDs", async () => {
    mockedGenerateJson.mockResolvedValue({
      flashcards: [
        {
          front: "What is the JavaScript event loop?",
          back: "Call stack; task queue; microtasks; macrotasks",
          requirement_ids: ["r1"],
        },
        {
          front: "What is React reconciliation?",
          back: "React compares the previous and next element trees and updates the necessary parts of the UI.",
          requirement_ids: ["r2"],
        },
        {
          front: "What is Docker used for?",
          back: "Packaging applications and their dependencies into portable containers.",
          requirement_ids: ["r3"],
        },
      ],
    });

    const result = await generateFlashcards(requirements);

    expect(result).toEqual<GeneratedFlashcard[]>([
      {
        id: "f1",
        front: "What is the JavaScript event loop?",
        back: "Call stack; task queue; microtasks; macrotasks",
        requirement_ids: ["r1"],
      },
      {
        id: "f2",
        front: "What is React reconciliation?",
        back: "React compares the previous and next element trees and updates the necessary parts of the UI.",
        requirement_ids: ["r2"],
      },
      {
        id: "f3",
        front: "What is Docker used for?",
        back: "Packaging applications and their dependencies into portable containers.",
        requirement_ids: ["r3"],
      },
    ]);

    expect(mockedGenerateJson).toHaveBeenCalledTimes(1);
  });

  it("rejects flashcards with unknown requirement IDs", async () => {
    mockedGenerateJson.mockResolvedValue({
      flashcards: [
        {
          front: "Invalid question",
          back: "Invalid answer",
          requirement_ids: ["r999"],
        },
      ],
    });

    await expect(
      generateFlashcards(requirements)
    ).rejects.toThrow(
      "Flashcard references unknown requirement ID: r999"
    );
  });

  it("rejects an empty requirement list", async () => {
    await expect(
      generateFlashcards([])
    ).rejects.toThrow(
      "Cannot generate flashcards without requirements."
    );

    expect(mockedGenerateJson).not.toHaveBeenCalled();
  });

  it("rejects an invalid LLM response", async () => {
    mockedGenerateJson.mockResolvedValue({
      flashcards: [
        {
          front: "",
          back: "Some answer",
          requirement_ids: ["r1"],
        },
      ],
    });

    await expect(
      generateFlashcards(requirements)
    ).rejects.toThrow();
  });
});