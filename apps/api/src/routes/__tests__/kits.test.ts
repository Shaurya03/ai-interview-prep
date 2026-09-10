import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSave, mockMarkModified, mockGenerateKitDraft } = vi.hoisted(
  () => ({
    mockSave: vi.fn(),
    mockMarkModified: vi.fn(),
    mockGenerateKitDraft: vi.fn(),
  })
);

const mockKit = {
  _id: "kit-123",
  ownerId: "user-123",
  name: "Frontend Interview",
  jobDescription: "Build React applications.",
  companyUrl: "https://example.com",
  daysAvailable: 5,
  status: "draft",
  data: null as any,
  builderState: {
    editedQuestions: {} as Record<
      string,
      {
        prompt: string;
        answer_outline: string;
      }
    >,
    editedFlashcards: {} as Record<
      string,
      {
        front: string;
        back: string;
      }
    >,
    editedCompanyBrief: {},
    questionOrder: [],
    deletedQuestionIds: [],
    deletedFlashcardIds: [],
  },
  save: mockSave,
  markModified: mockMarkModified,
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

describe("PATCH /kits/:id/builder", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockKit.status = "ready";

    mockKit.data = {
      source: {
        company: "Test Company",
        company_url: "https://example.com",
        role: "Software Engineer",
        location: "Remote",
        jd_chars: 25,
        researched_at: new Date().toISOString(),
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
        requirements: [
          {
            id: "r1",
            text: "React",
            kind: "technical",
            priority: "must",
          },
        ],
      },

      questions: [
        {
          id: "q1",
          requirement_ids: ["r1"],
          category: "technical",
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
        uncovered_requirement_ids: [],
        passes: 1,
      },
    };

    mockKit.builderState = {
      editedQuestions: {} as Record<
        string,
        {
          prompt: string;
          answer_outline: string;
        }
      >,
      editedFlashcards: {},
      editedCompanyBrief: {},
      questionOrder: [],
      deletedQuestionIds: [],
      deletedFlashcardIds: [],
    };

    mockSave.mockResolvedValue(mockKit);
  });

  it("updates a question successfully", async () => {
    mockedKit.findOne.mockResolvedValue(mockKit as never);

    const app = createApp();

    const response = await request(app)
      .patch("/kits/kit-123/builder")
      .send({
        questionId: "q1",
        prompt: "How does React state work?",
        answer_outline: "Explain state, updates, and re-renders.",
      })
      .expect(200);

    expect(mockedKit.findOne).toHaveBeenCalledWith({
      _id: "kit-123",
      ownerId: "user-123",
    });

    expect(mockKit.data.questions[0]).toMatchObject({
      id: "q1",
      prompt: "How does React state work?",
      answer_outline: "Explain state, updates, and re-renders.",
    });

    expect(mockKit.builderState.editedQuestions.q1).toEqual({
      prompt: "How does React state work?",
      answer_outline: "Explain state, updates, and re-renders.",
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockMarkModified).toHaveBeenCalledWith("data");
    expect(mockMarkModified).toHaveBeenCalledWith("builderState");

    expect(response.body.kit.status).toBe("ready");

    expect(response.body.kit.data.questions[0]).toMatchObject({
      id: "q1",
      prompt: "How does React state work?",
      answer_outline: "Explain state, updates, and re-renders.",
    });
  });

  it("returns 404 when the kit does not belong to the user or does not exist", async () => {
    mockedKit.findOne.mockResolvedValue(null);

    const app = createApp();

    const response = await request(app)
      .patch("/kits/kit-123/builder")
      .send({
        questionId: "q1",
        prompt: "Updated question",
      })
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: "KIT_NOT_FOUND",
        message: "Interview kit not found.",
      },
    });

    expect(mockSave).not.toHaveBeenCalled();
  });

  it("returns 409 when the kit is not ready", async () => {
    mockKit.status = "draft";

    mockedKit.findOne.mockResolvedValue(mockKit as never);

    const app = createApp();

    const response = await request(app)
      .patch("/kits/kit-123/builder")
      .send({
        questionId: "q1",
        prompt: "Updated question",
      })
      .expect(409);

    expect(response.body).toEqual({
      error: {
        code: "KIT_NOT_READY",
        message: "Only a generated kit can be edited.",
      },
    });

    expect(mockSave).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid payload", async () => {
    mockedKit.findOne.mockResolvedValue(mockKit as never);

    const app = createApp();

    const response = await request(app)
      .patch("/kits/kit-123/builder")
      .send({
        prompt: "Updated question",
      })
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_BUILDER_UPDATE");

    expect(mockSave).not.toHaveBeenCalled();
  });

  it("returns 404 when the question does not exist", async () => {
    mockedKit.findOne.mockResolvedValue(mockKit as never);

    const app = createApp();

    const response = await request(app)
      .patch("/kits/kit-123/builder")
      .send({
        questionId: "q999",
        prompt: "Updated question",
      })
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: "QUESTION_NOT_FOUND",
        message: "Question not found.",
      },
    });

    expect(mockSave).not.toHaveBeenCalled();
  });

  it("updates a flashcard successfully", async () => {
    mockedKit.findOne.mockResolvedValue(mockKit as never);

    const app = createApp();

    const response = await request(app)
      .patch("/kits/kit-123/builder")
      .send({
        flashcardId: "f1",
        front: "What is React?",
        back: "A JavaScript library for building user interfaces.",
      })
      .expect(200);

    expect(mockedKit.findOne).toHaveBeenCalledWith({
      _id: "kit-123",
      ownerId: "user-123",
    });

    expect(mockKit.data.flashcards[0]).toMatchObject({
      id: "f1",
      front: "What is React?",
      back: "A JavaScript library for building user interfaces.",
    });

    expect(mockKit.builderState.editedFlashcards.f1).toEqual({
      front: "What is React?",
      back: "A JavaScript library for building user interfaces.",
    });

    expect(mockMarkModified).toHaveBeenCalledWith("data");
    expect(mockMarkModified).toHaveBeenCalledWith("builderState");

    expect(mockSave).toHaveBeenCalledTimes(1);

    expect(response.body.kit.status).toBe("ready");

    expect(response.body.kit.data.flashcards[0]).toMatchObject({
      id: "f1",
      front: "What is React?",
      back: "A JavaScript library for building user interfaces.",
    });
  });

  it("returns 404 when the flashcard does not exist", async () => {
    mockedKit.findOne.mockResolvedValue(mockKit as never);

    const app = createApp();

    const response = await request(app)
      .patch("/kits/kit-123/builder")
      .send({
        flashcardId: "does-not-exist",
        front: "Updated front",
      })
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: "FLASHCARD_NOT_FOUND",
        message: "Flashcard not found.",
      },
    });

    expect(mockSave).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid flashcard payload", async () => {
    mockedKit.findOne.mockResolvedValue(mockKit as never);

    const app = createApp();

    const response = await request(app)
      .patch("/kits/kit-123/builder")
      .send({
        flashcardId: "",
        front: "",
      })
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_BUILDER_UPDATE");

    expect(mockSave).not.toHaveBeenCalled();
  });

  it("returns 409 when generated flashcards are missing", async () => {
    mockKit.data = {
      questions: [
        {
          id: "q1",
          prompt: "How does React state work?",
          answer_outline: "Explain state and re-renders.",
        },
      ],
    };

    mockedKit.findOne.mockResolvedValue(mockKit as never);

    const app = createApp();

    const response = await request(app)
      .patch("/kits/kit-123/builder")
      .send({
        flashcardId: "f1",
        front: "What is React?",
      })
      .expect(409);

    expect(response.body).toEqual({
      error: {
        code: "KIT_DATA_MISSING",
        message: "This kit does not contain generated flashcards.",
      },
    });

    expect(mockSave).not.toHaveBeenCalled();
  });

  it("updates the company brief successfully", async () => {
    mockedKit.findOne.mockResolvedValue(mockKit as never);

    mockKit.data = {
      source: {
        company: "Test Company",
        company_url: "https://example.com",
        role: "Software Engineer",
        location: "Remote",
        jd_chars: 100,
        researched_at: "2026-01-01T00:00:00.000Z",
        pages_used: ["https://example.com"],
      },
      company_brief: {
        summary: "Original company summary.",
        what_they_do: "Original company description.",
        sources: ["https://example.com"],
      },
      role: {
        title: "Software Engineer",
        seniority: "Mid-level",
        responsibilities: ["Build software"],
        requirements: [],
      },
      questions: [],
      flashcards: [],
      schedule: {
        days_available: 5,
        days: [],
      },
      coverage: {
        uncovered_requirement_ids: [],
        passes: 1,
      },
    };

    mockKit.builderState = {
      editedQuestions: {},
      editedFlashcards: {},
      editedCompanyBrief: {},
      questionOrder: [],
      deletedQuestionIds: [],
      deletedFlashcardIds: [],
    };

    const app = createApp();

    const response = await request(app)
      .patch("/kits/kit-123/builder")
      .send({
        companyBrief: {
          summary: "Updated company summary.",
          what_they_do: "Updated company description.",
        },
      });

    expect(response.status).toBe(200);

    expect(mockKit.data.company_brief).toEqual({
      summary: "Updated company summary.",
      what_they_do: "Updated company description.",
      sources: ["https://example.com"],
    });

    expect(mockKit.builderState.editedCompanyBrief).toEqual({
      summary: "Updated company summary.",
      what_they_do: "Updated company description.",
    });

    expect(mockMarkModified).toHaveBeenCalledWith("data");
    expect(mockMarkModified).toHaveBeenCalledWith("builderState");
    expect(mockSave).toHaveBeenCalledTimes(1);

    expect(response.body.kit.status).toBe("ready");
  });

  it("returns 404 when the company brief does not exist", async () => {
    mockedKit.findOne.mockResolvedValue(mockKit as never);

    mockKit.data = {
      questions: [],
      flashcards: [],
    };

    const app = createApp();

    const response = await request(app)
      .patch("/kits/kit-123/builder")
      .send({
        companyBrief: {
          summary: "Updated summary.",
          what_they_do: "Updated description.",
        },
      });

    expect(response.status).toBe(404);

    expect(response.body.error.code).toBe(
      "COMPANY_BRIEF_NOT_FOUND"
    );
  });

  it("returns 400 for an invalid company brief payload", async () => {
    const app = createApp();

    const response = await request(app)
      .patch("/kits/kit-123/builder")
      .send({
        companyBrief: {
          summary: "",
          what_they_do: "",
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(
      "INVALID_BUILDER_UPDATE"
    );
  });

  it("preserves company brief sources when the brief is edited", async () => {
    mockedKit.findOne.mockResolvedValue(mockKit as never);

    mockKit.data = {
      company_brief: {
        summary: "Original summary.",
        what_they_do: "Original description.",
        sources: [
          "https://example.com/about",
          "https://example.com/company",
        ],
      },
    };

    const app = createApp();

    const response = await request(app)
      .patch("/kits/kit-123/builder")
      .send({
        companyBrief: {
          summary: "Edited summary.",
          what_they_do: "Edited description.",
        },
      });

    expect(response.status).toBe(200);

    expect(response.body.kit.data.company_brief).toEqual({
      summary: "Edited summary.",
      what_they_do: "Edited description.",
      sources: [
        "https://example.com/about",
        "https://example.com/company",
      ],
    });
  });
});