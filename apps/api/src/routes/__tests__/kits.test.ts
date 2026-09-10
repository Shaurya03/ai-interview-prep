import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSave, mockGenerateKitDraft } = vi.hoisted(() => ({
  mockSave: vi.fn(),
  mockGenerateKitDraft: vi.fn(),
}));

const mockKit = {
  _id: "kit-123",
  ownerId: "user-123",
  name: "Frontend Interview",
  jobDescription: "Build React applications.",
  companyUrl: "https://example.com",
  daysAvailable: 5,
  status: "draft",
  data: null,
  save: mockSave,
};

vi.mock("../../middleware/require-auth.js", () => ({
  requireAuth: (
    request: { userId?: string },
    _response: unknown,
    next: () => void
  ) => {
    request.userId = "user-123";
    next();
  },
}));

vi.mock("../../models/kit.js", () => ({
  Kit: {
    findOne: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("../../services/kit-generator.js", () => ({
  generateKitDraft: mockGenerateKitDraft,
}));

import { Kit } from "../../models/kit.js";
import { createApp } from "../../app.js";

const mockedKit = vi.mocked(Kit);

const generatedDraft = {
  role: {
    title: "Software Engineer",
    seniority: "Mid-level",
    company: "Test Company",
    location: "Remote",
    responsibilities: ["Build software"],
  },

  requirements: [
    {
      id: "r1",
      text: "React",
      kind: "technical" as const,
      priority: "must" as const,
    },
  ],

  research: {
    pages: [],
    pagesUsed: ["https://example.com"],
    gaps: [],
  },

  companyBrief: {
    summary: "Example company.",
    what_they_do: "Build software.",
    sources: ["https://example.com"],
  },

  questions: [
    {
      id: "q1",
      requirement_ids: ["r1"],
      category: "technical" as const,
      prompt: "Explain React state.",
      answer_outline: "State stores component data.",
      difficulty: 2,
    },
  ],

  flashcards: [
    {
      id: "f1",
      front: "What is React?",
      back: "A UI library.",
      requirement_ids: ["r1"],
    },
  ],

  schedule: {
    days_available: 5,
    days: [
      {
        day: 1,
        focus: "React",
        question_ids: ["q1"],
        minutes: 8,
      },
      {
        day: 2,
        focus: "Interview practice",
        question_ids: [],
        minutes: 0,
      },
      {
        day: 3,
        focus: "Interview practice",
        question_ids: [],
        minutes: 0,
      },
      {
        day: 4,
        focus: "Interview practice",
        question_ids: [],
        minutes: 0,
      },
      {
        day: 5,
        focus: "Interview practice",
        question_ids: [],
        minutes: 0,
      },
    ],
  },

  coverage: {
    uncoveredRequirementIds: [],
    passes: 1,
  },
};

describe("POST /kits/:id/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockKit.status = "draft";
    mockKit.data = null;

    mockSave.mockResolvedValue(mockKit);
    mockGenerateKitDraft.mockResolvedValue(generatedDraft);
  });

  it("generates and saves a kit successfully", async () => {
    mockedKit.findOne.mockResolvedValue(mockKit as never);

    const app = createApp();

    const response = await request(app)
      .post("/kits/kit-123/generate")
      .expect(200);

    expect(mockedKit.findOne).toHaveBeenCalledWith({
      _id: "kit-123",
      ownerId: "user-123",
    });

    expect(mockGenerateKitDraft).toHaveBeenCalledWith(
      "Build React applications.",
      "https://example.com",
      5
    );

    expect(mockKit.status).toBe("ready");

    expect(mockKit.data).toMatchObject({
      source: {
        company: "Test Company",
        company_url: "https://example.com",
        role: "Software Engineer",
        location: "Remote",
        jd_chars: "Build React applications.".length,
        pages_used: ["https://example.com"],
      },

      company_brief: {
        summary: "Example company.",
        what_they_do: "Build software.",
        sources: ["https://example.com"],
      },

      role: {
        title: "Software Engineer",
        seniority: "Mid-level",
        responsibilities: ["Build software"],
        requirements: generatedDraft.requirements,
      },

      questions: generatedDraft.questions,

      flashcards: generatedDraft.flashcards,

      schedule: generatedDraft.schedule,

      coverage: {
        uncovered_requirement_ids: [],
        passes: 1,
      },
    });

    expect(mockSave).toHaveBeenCalledTimes(2);

    expect(response.body).toEqual({
      status: "ready",
      data: mockKit.data,
    });
  });

  it("returns 409 when generation is already in progress", async () => {
    mockKit.status = "generating";

    mockedKit.findOne.mockResolvedValue(mockKit as never);

    const app = createApp();

    const response = await request(app)
      .post("/kits/kit-123/generate")
      .expect(409);

    expect(response.body).toEqual({
      error: {
        code: "GENERATION_IN_PROGRESS",
        message: "This interview kit is already being generated.",
      },
    });

    expect(mockGenerateKitDraft).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("returns 404 when the kit does not belong to the user or does not exist", async () => {
    mockedKit.findOne.mockResolvedValue(null);

    const app = createApp();

    const response = await request(app)
      .post("/kits/kit-123/generate")
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: "KIT_NOT_FOUND",
        message: "Interview kit not found.",
      },
    });

    expect(mockGenerateKitDraft).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("marks the kit as failed when generation throws", async () => {
    mockedKit.findOne.mockResolvedValue(mockKit as never);

    mockGenerateKitDraft.mockRejectedValue(
      new Error("Gemini temporarily unavailable.")
    );

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => { });

    const app = createApp();

    const response = await request(app)
      .post("/kits/kit-123/generate")
      .expect(500);

    expect(mockKit.status).toBe("failed");

    expect(mockSave).toHaveBeenCalledTimes(2);

    expect(response.body).toEqual({
      error: {
        code: "GENERATION_FAILED",
        message: "Gemini temporarily unavailable.",
      },
    });

    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});