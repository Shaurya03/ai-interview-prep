import { Router } from "express";
import { z } from "zod";
import { kitSchema } from "@ai-interview-prep/shared";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/require-auth.js";
import { Kit } from "../models/kit.js";
import { generateKitDraft } from "../services/kit-generator.js";

const createKitSchema = z.object({
  name: z.string().trim().min(1).max(120),
  jobDescription: z.string().trim().min(1),
  companyUrl: z.url(),
  daysAvailable: z.number().int().min(1).max(60),
});

const practiceResponseSchema = z.object({
  flashcardId: z.string().trim().min(1),
  answer: z.string().trim().min(1).max(10000),
  confidence: z.enum(["low", "medium", "high"]),
});

const updateBuilderSchema = z.union([
  // Question category update MUST come before
  // the generic question update.
  z.object({
    questionId: z.string().trim().min(1),
    category: z.enum([
      "technical",
      "behavioural",
      "system-design",
      "company-fit",
    ]),
  }),

  // Question text / answer update
  z.object({
    questionId: z.string().trim().min(1),
    prompt: z.string().trim().min(1).optional(),
    answer_outline: z.string().trim().min(1).optional(),
  }),

  // Delete question
  z.object({
    deleteQuestionId: z.string().trim().min(1),
  }),

  // Reorder questions
  z.object({
    questionOrder: z.array(z.string().trim().min(1)).min(1),
  }),

  // Flashcard update
  z.object({
    flashcardId: z.string().trim().min(1),
    front: z.string().trim().min(1).optional(),
    back: z.string().trim().min(1).optional(),
  }),

  // Company brief update
  z.object({
    companyBrief: z.object({
      summary: z.string().trim().min(1),
      what_they_do: z.string().trim().min(1),
    }),
  }),
]);

export const kitsRouter = Router();

kitsRouter.use(requireAuth);

kitsRouter.get(
  "/",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const kits = await Kit.find({ ownerId: request.userId })
        .sort({ updatedAt: -1 })
        .select(
          "name companyUrl daysAvailable status createdAt updatedAt"
        );

      return response.json({ kits });
    } catch (error) {
      return next(error);
    }
  }
);

kitsRouter.get(
  "/:id",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const kit = await Kit.findOne({
        _id: request.params.id,
        ownerId: request.userId,
      }).select(
        "name jobDescription companyUrl daysAvailable status data builderState createdAt updatedAt"
      );

      if (!kit) {
        return response.status(404).json({
          error: {
            code: "KIT_NOT_FOUND",
            message: "Interview kit not found.",
          },
        });
      }

      return response.json({ kit });
    } catch (error) {
      return next(error);
    }
  }
);

kitsRouter.patch(
  "/:id/builder",
  async (request: AuthenticatedRequest, response) => {
    try {
      const userId = request.userId;

      const kit = await Kit.findOne({
        _id: request.params.id,
        ownerId: userId,
      });

      if (!kit) {
        return response.status(404).json({
          error: {
            code: "KIT_NOT_FOUND",
            message: "Interview kit not found.",
          },
        });
      }

      if (kit.status !== "ready") {
        return response.status(409).json({
          error: {
            code: "KIT_NOT_READY",
            message: "Only a generated kit can be edited.",
          },
        });
      }

      const parsed = updateBuilderSchema.safeParse(request.body);

      if (!parsed.success) {
        return response.status(400).json({
          error: {
            code: "INVALID_BUILDER_UPDATE",
            message: "Invalid builder update.",
            details: parsed.error.flatten(),
          },
        });
      }

      const data = kit.data as {
        questions?: Array<{
          id: string;
          requirement_ids: string[];
          category: string;
          prompt: string;
          answer_outline: string;
          difficulty: number;
        }>;

        flashcards?: Array<{
          id: string;
          front: string;
          back: string;
          requirement_ids: string[];
        }>;

        company_brief?: {
          summary: string;
          what_they_do: string;
          sources?: string[];
        };

        role?: {
          requirements: Array<{
            id: string;
            text: string;
            kind: string;
            priority: string;
          }>;
        };

        schedule?: {
          days_available: number;
          days: Array<{
            day: number;
            focus: string;
            question_ids: string[];
            minutes: number;
          }>;
        };

        coverage: {
          uncovered_requirement_ids: string[];
          passes: number;
        };
      } | null;

      if (!data) {
        return response.status(409).json({
          error: {
            code: "KIT_DATA_MISSING",
            message: "This kit does not contain generated data.",
          },
        });
      }

      /*
       * Question reorder
       */
      if ("questionOrder" in parsed.data) {
        const { questionOrder } = parsed.data;

        if (!data.questions) {
          return response.status(409).json({
            error: {
              code: "KIT_DATA_MISSING",
              message: "This kit does not contain generated questions.",
            },
          });
        }

        const currentQuestionIds = data.questions.map(
          (question) => question.id
        );

        const uniqueQuestionIds = new Set(questionOrder);

        if (uniqueQuestionIds.size !== questionOrder.length) {
          return response.status(400).json({
            error: {
              code: "INVALID_QUESTION_ORDER",
              message: "Question order cannot contain duplicate question ids.",
            },
          });
        }

        if (
          questionOrder.length !== currentQuestionIds.length ||
          !currentQuestionIds.every((questionId) =>
            uniqueQuestionIds.has(questionId)
          )
        ) {
          return response.status(400).json({
            error: {
              code: "INVALID_QUESTION_ORDER",
              message:
                "Question order must contain every existing question exactly once.",
            },
          });
        }

        const questionsById = new Map(
          data.questions.map((question) => [question.id, question])
        );

        data.questions = questionOrder.map(
          (questionId) => questionsById.get(questionId)!
        );

        const builderState = (kit.builderState ?? {}) as {
          questionOrder?: string[];
          editedQuestions?: Record<
            string,
            {
              prompt?: string;
              answer_outline?: string;
              category?: "technical" | "behavioural" | "system-design" | "company-fit";
            }
          >;
          editedFlashcards?: Record<
            string,
            {
              front?: string;
              back?: string;
            }
          >;
          editedCompanyBrief?: {
            summary?: string;
            what_they_do?: string;
          };
          deletedQuestionIds?: string[];
          deletedFlashcardIds?: string[];
        };

        builderState.questionOrder = [...questionOrder];

        kit.data = data;
        kit.builderState = builderState;

        kit.markModified("data");
        kit.markModified("builderState");

        await kit.save();

        return response.json({
          kit: {
            _id: kit._id,
            status: kit.status,
            data: kit.data,
            builderState: kit.builderState,
          },
        });
      }

      /*
       * Question update
       */
      if (
        "questionId" in parsed.data &&
        ("prompt" in parsed.data || "answer_outline" in parsed.data)
      ) {
        const {
          questionId,
          prompt,
          answer_outline,
        } = parsed.data;

        if (!data.questions) {
          return response.status(409).json({
            error: {
              code: "KIT_DATA_MISSING",
              message: "This kit does not contain generated questions.",
            },
          });
        }

        const question = data.questions.find(
          (item) => item.id === questionId
        );

        if (!question) {
          return response.status(404).json({
            error: {
              code: "QUESTION_NOT_FOUND",
              message: "Question not found.",
            },
          });
        }

        if (prompt !== undefined) {
          question.prompt = prompt;
        }

        if (answer_outline !== undefined) {
          question.answer_outline = answer_outline;
        }

        const builderState = (kit.builderState ?? {}) as {
          editedQuestions?: Record<
            string,
            {
              prompt?: string;
              answer_outline?: string;
              category?: "technical" | "behavioural" | "system-design" | "company-fit";
            }
          >;
          editedFlashcards?: Record<
            string,
            {
              front?: string;
              back?: string;
            }
          >;
          editedCompanyBrief?: {
            summary?: string;
            what_they_do?: string;
          };
        };

        if (!builderState.editedQuestions) {
          builderState.editedQuestions = {};
        }

        builderState.editedQuestions[questionId] = {
          ...(builderState.editedQuestions[questionId] ?? {}),
          ...(prompt !== undefined ? { prompt } : {}),
          ...(answer_outline !== undefined
            ? { answer_outline }
            : {}),
        };

        kit.builderState = builderState;

        kit.markModified("data");
        kit.markModified("builderState");

        await kit.save();

        return response.json({
          kit: {
            _id: kit._id,
            status: kit.status,
            data: kit.data,
            builderState: kit.builderState,
          },
        });
      }

      /*
       * Question category update
       */
      if ("questionId" in parsed.data && "category" in parsed.data) {
        const { questionId, category } = parsed.data;

        if (!data.questions) {
          return response.status(409).json({
            error: {
              code: "KIT_DATA_MISSING",
              message: "This kit does not contain generated questions.",
            },
          });
        }

        const question = data.questions.find(
          (item) => item.id === questionId
        );

        if (!question) {
          return response.status(404).json({
            error: {
              code: "QUESTION_NOT_FOUND",
              message: "Question not found.",
            },
          });
        }

        question.category = category;

        const builderState = (kit.builderState ?? {}) as {
          editedQuestions?: Record<
            string,
            {
              prompt?: string;
              answer_outline?: string;
              category?: "technical" | "behavioural" | "system-design" | "company-fit";
            }
          >;
          editedFlashcards?: Record<
            string,
            {
              front?: string;
              back?: string;
            }
          >;
          editedCompanyBrief?: {
            summary?: string;
            what_they_do?: string;
          };
        };

        if (!builderState.editedQuestions) {
          builderState.editedQuestions = {};
        }

        builderState.editedQuestions[questionId] = {
          ...(builderState.editedQuestions[questionId] ?? {}),
          category,
        };

        kit.data = data;
        kit.builderState = builderState;

        kit.markModified("data");
        kit.markModified("builderState");

        await kit.save();

        return response.json({
          kit: {
            _id: kit._id,
            status: kit.status,
            data: kit.data,
            builderState: kit.builderState,
          },
        });
      }

      /*
       * Question deletion
       */
      if ("deleteQuestionId" in parsed.data) {
        const { deleteQuestionId } = parsed.data;

        if (!data.questions) {
          return response.status(409).json({
            error: {
              code: "KIT_DATA_MISSING",
              message: "This kit does not contain generated questions.",
            },
          });
        }

        const questionExists = data.questions.some(
          (question) => question.id === deleteQuestionId
        );

        if (!questionExists) {
          return response.status(404).json({
            error: {
              code: "QUESTION_NOT_FOUND",
              message: "Question not found.",
            },
          });
        }

        data.questions = data.questions.filter(
          (question) => question.id !== deleteQuestionId
        );

        if (data.schedule?.days) {
          data.schedule.days = data.schedule.days.map((day) => ({
            ...day,
            question_ids: day.question_ids.filter(
              (questionId) => questionId !== deleteQuestionId
            ),
          }));
        }

        const builderState = (kit.builderState ?? {}) as {
          editedQuestions?: Record<
            string,
            {
              prompt?: string;
              answer_outline?: string;
              category?: "technical" | "behavioural" | "system-design" | "company-fit";
            }
          >;
          editedFlashcards?: Record<
            string,
            {
              front?: string;
              back?: string;
            }
          >;
          editedCompanyBrief?: {
            summary?: string;
            what_they_do?: string;
          };
          questionOrder?: string[];
          deletedQuestionIds?: string[];
          deletedFlashcardIds?: string[];
        };

        if (!builderState.deletedQuestionIds) {
          builderState.deletedQuestionIds = [];
        }

        if (!builderState.deletedQuestionIds.includes(deleteQuestionId)) {
          builderState.deletedQuestionIds.push(deleteQuestionId);
        }

        if (builderState.questionOrder) {
          builderState.questionOrder = builderState.questionOrder.filter(
            (questionId) => questionId !== deleteQuestionId
          );
        }

        /*
         * Recalculate requirement coverage after deletion.
         * A requirement is covered when at least one remaining
         * question references it.
         */
        if (data.role?.requirements && data.coverage) {
          const remainingQuestionRequirementIds = new Set(
            data.questions.flatMap(
              (question) => question.requirement_ids
            )
          );

          data.coverage.uncovered_requirement_ids =
            data.role.requirements
              .filter(
                (requirement) =>
                  !remainingQuestionRequirementIds.has(requirement.id)
              )
              .map((requirement) => requirement.id);
        }

        kit.data = data;
        kit.builderState = builderState;

        kit.markModified("data");
        kit.markModified("builderState");

        await kit.save();

        return response.json({
          kit: {
            _id: kit._id,
            status: kit.status,
            data: kit.data,
            builderState: kit.builderState,
          },
        });
      }

      /*
       * Flashcard update
       */
      if ("flashcardId" in parsed.data) {
        const {
          flashcardId,
          front,
          back,
        } = parsed.data;

        if (!data.flashcards) {
          return response.status(409).json({
            error: {
              code: "KIT_DATA_MISSING",
              message: "This kit does not contain generated flashcards.",
            },
          });
        }

        const flashcard = data.flashcards.find(
          (item) => item.id === flashcardId
        );

        if (!flashcard) {
          return response.status(404).json({
            error: {
              code: "FLASHCARD_NOT_FOUND",
              message: "Flashcard not found.",
            },
          });
        }

        if (front !== undefined) {
          flashcard.front = front;
        }

        if (back !== undefined) {
          flashcard.back = back;
        }

        const builderState = (kit.builderState ?? {}) as {
          editedQuestions?: Record<
            string,
            {
              prompt?: string;
              answer_outline?: string;
              category?: "technical" | "behavioural" | "system-design" | "company-fit";
            }
          >;
          editedFlashcards?: Record<
            string,
            {
              front?: string;
              back?: string;
            }
          >;
          editedCompanyBrief?: {
            summary?: string;
            what_they_do?: string;
          };
        };

        if (!builderState.editedFlashcards) {
          builderState.editedFlashcards = {};
        }

        builderState.editedFlashcards[flashcardId] = {
          ...(builderState.editedFlashcards[flashcardId] ?? {}),
          ...(front !== undefined ? { front } : {}),
          ...(back !== undefined ? { back } : {}),
        };

        kit.builderState = builderState;

        kit.markModified("data");
        kit.markModified("builderState");

        await kit.save();

        return response.json({
          kit: {
            _id: kit._id,
            status: kit.status,
            data: kit.data,
            builderState: kit.builderState,
          },
        });
      }

      /*
       * Company brief update
       */
      if (!("companyBrief" in parsed.data)) {
        return response.status(400).json({
          error: {
            code: "INVALID_BUILDER_UPDATE",
            message: "Invalid company brief update.",
          },
        });
      }

      const { companyBrief } = parsed.data;

      if (!data.company_brief) {
        return response.status(404).json({
          error: {
            code: "COMPANY_BRIEF_NOT_FOUND",
            message: "This kit does not contain a company brief.",
          },
        });
      }

      data.company_brief.summary = companyBrief.summary;
      data.company_brief.what_they_do = companyBrief.what_they_do;

      const builderState = (kit.builderState ?? {}) as {
        editedQuestions?: Record<
          string,
          {
            prompt?: string;
            answer_outline?: string;
          }
        >;
        editedFlashcards?: Record<
          string,
          {
            front?: string;
            back?: string;
          }
        >;
        editedCompanyBrief?: {
          summary?: string;
          what_they_do?: string;
        };
      };

      builderState.editedCompanyBrief = {
        ...(builderState.editedCompanyBrief ?? {}),
        summary: companyBrief.summary,
        what_they_do: companyBrief.what_they_do,
      };

      kit.data = data;
      kit.builderState = builderState;

      kit.markModified("data");
      kit.markModified("builderState");

      await kit.save();

      return response.json({
        kit: {
          _id: kit._id,
          status: kit.status,
          data: kit.data,
          builderState: kit.builderState,
        },
      });
    } catch (error) {
      console.error("Builder update failed:", error);

      return response.status(500).json({
        error: {
          code: "BUILDER_UPDATE_FAILED",
          message: "Unable to update the interview kit.",
        },
      });
    }
  }
);


/*
 * Practice Mode
 *
 * Practice responses are persisted inside builderState so a user can leave
 * and reopen a kit without losing their confidence history. This also keeps
 * practice state separate from the generated Appendix A kit data.
 */
kitsRouter.get(
  "/:id/practice",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const kit = await Kit.findOne({
        _id: request.params.id,
        ownerId: request.userId,
      }).select("_id status data builderState");

      if (!kit) {
        return response.status(404).json({
          error: {
            code: "KIT_NOT_FOUND",
            message: "Interview kit not found.",
          },
        });
      }

      if (kit.status !== "ready" || !kit.data) {
        return response.status(409).json({
          error: {
            code: "KIT_NOT_READY",
            message: "Practice mode is only available for a generated kit.",
          },
        });
      }

      const builderState = (kit.builderState ?? {}) as {
        practiceResponses?: Record<
          string,
          {
            answer: string;
            confidence: "low" | "medium" | "high";
            updatedAt: string;
          }
        >;
      };

      return response.json({
        responses: builderState.practiceResponses ?? {},
      });
    } catch (error) {
      return next(error);
    }
  },
);

kitsRouter.put(
  "/:id/practice/:flashcardId",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const parsed = practiceResponseSchema.safeParse({
        ...(request.body ?? {}),
        flashcardId: request.params.flashcardId,
      });

      if (!parsed.success) {
        return response.status(400).json({
          error: {
            code: "INVALID_PRACTICE_RESPONSE",
            message: "Invalid practice response.",
            details: parsed.error.flatten(),
          },
        });
      }

      const kit = await Kit.findOne({
        _id: request.params.id,
        ownerId: request.userId,
      });

      if (!kit) {
        return response.status(404).json({
          error: {
            code: "KIT_NOT_FOUND",
            message: "Interview kit not found.",
          },
        });
      }

      if (kit.status !== "ready" || !kit.data) {
        return response.status(409).json({
          error: {
            code: "KIT_NOT_READY",
            message: "Practice mode is only available for a generated kit.",
          },
        });
      }

      const data = kit.data as {
        flashcards?: Array<{
          id: string;
          front: string;
          back: string;
          requirement_ids: string[];
        }>;
      };

      const flashcard = data.flashcards?.find(
        (item) => item.id === parsed.data.flashcardId,
      );

      if (!flashcard) {
        return response.status(404).json({
          error: {
            code: "FLASHCARD_NOT_FOUND",
            message: "Flashcard not found.",
          },
        });
      }

      const builderState = (kit.builderState ?? {}) as {
        practiceResponses?: Record<
          string,
          {
            answer: string;
            confidence: "low" | "medium" | "high";
            updatedAt: string;
          }
        >;
      };

      if (!builderState.practiceResponses) {
        builderState.practiceResponses = {};
      }

      const savedResponse = {
        answer: parsed.data.answer,
        confidence: parsed.data.confidence,
        updatedAt: new Date().toISOString(),
      };

      builderState.practiceResponses[parsed.data.flashcardId] = savedResponse;

      kit.builderState = builderState;
      kit.markModified("builderState");
      await kit.save();

      return response.json({
        response: {
          flashcardId: parsed.data.flashcardId,
          ...savedResponse,
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

kitsRouter.post(
  "/:id/generate",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = request.userId;

      const kit = await Kit.findOne({
        _id: request.params.id,
        ownerId: userId,
      });

      if (!kit) {
        return response.status(404).json({
          error: {
            code: "KIT_NOT_FOUND",
            message: "Interview kit not found.",
          },
        });
      }

      if (kit.status === "generating") {
        return response.status(409).json({
          error: {
            code: "GENERATION_IN_PROGRESS",
            message: "This interview kit is already being generated.",
          },
        });
      }

      kit.status = "generating";

      await kit.save();

      try {
        const draft = await generateKitDraft(
          kit.jobDescription,
          kit.companyUrl,
          kit.daysAvailable
        );

        const data = {
          source: {
            company: draft.role.company,
            company_url: kit.companyUrl,
            role: draft.role.title,
            location: draft.role.location,
            jd_chars: kit.jobDescription.length,
            researched_at: new Date().toISOString(),
            pages_used: draft.research.pagesUsed,
          },

          company_brief: {
            summary: draft.companyBrief.summary,
            what_they_do: draft.companyBrief.what_they_do,
            sources: draft.companyBrief.sources,
          },

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

        const validatedKit = kitSchema.parse(data);

        /*
         * Preserve builder edits when a kit is regenerated.
         *
         * The generator creates a fresh draft, but user edits live in
         * builderState. Reapply those edits by stable question/flashcard ids,
         * then restore deleted questions and the user's question order.
         */
        const builderState = (kit.builderState ?? {}) as {
          editedQuestions?: Record<
            string,
            {
              prompt?: string;
              answer_outline?: string;
              category?:
              | "technical"
              | "behavioural"
              | "system-design"
              | "company-fit";
            }
          >;
          editedFlashcards?: Record<
            string,
            {
              front?: string;
              back?: string;
            }
          >;
          editedCompanyBrief?: {
            summary?: string;
            what_they_do?: string;
          };
          questionOrder?: string[];
          deletedQuestionIds?: string[];
          deletedFlashcardIds?: string[];
        };

        if (validatedKit.questions && builderState.editedQuestions) {
          for (const question of validatedKit.questions) {
            const edit = builderState.editedQuestions[question.id];

            if (!edit) continue;

            if (edit.prompt !== undefined) {
              question.prompt = edit.prompt;
            }

            if (edit.answer_outline !== undefined) {
              question.answer_outline = edit.answer_outline;
            }

            if (edit.category !== undefined) {
              question.category = edit.category;
            }
          }
        }

        if (validatedKit.flashcards) {
          if (builderState.editedFlashcards) {
            for (const flashcard of validatedKit.flashcards) {
              const edit = builderState.editedFlashcards[flashcard.id];

              if (!edit) continue;

              if (edit.front !== undefined) {
                flashcard.front = edit.front;
              }

              if (edit.back !== undefined) {
                flashcard.back = edit.back;
              }
            }
          }

          if (builderState.deletedFlashcardIds?.length) {
            const deletedFlashcardIds = new Set(
              builderState.deletedFlashcardIds
            );

            validatedKit.flashcards = validatedKit.flashcards.filter(
              (flashcard) => !deletedFlashcardIds.has(flashcard.id)
            );
          }
        }

        if (validatedKit.company_brief && builderState.editedCompanyBrief) {
          if (builderState.editedCompanyBrief.summary !== undefined) {
            validatedKit.company_brief.summary =
              builderState.editedCompanyBrief.summary;
          }

          if (
            builderState.editedCompanyBrief.what_they_do !== undefined
          ) {
            validatedKit.company_brief.what_they_do =
              builderState.editedCompanyBrief.what_they_do;
          }
        }

        if (
          validatedKit.questions &&
          builderState.deletedQuestionIds?.length
        ) {
          const deletedQuestionIds = new Set(
            builderState.deletedQuestionIds
          );

          validatedKit.questions = validatedKit.questions.filter(
            (question) => !deletedQuestionIds.has(question.id)
          );

          validatedKit.schedule.days = validatedKit.schedule.days.map(
            (day) => ({
              ...day,
              question_ids: day.question_ids.filter(
                (questionId) => !deletedQuestionIds.has(questionId)
              ),
            })
          );
        }

        if (
          validatedKit.questions &&
          builderState.questionOrder?.length
        ) {
          const questionsById = new Map(
            validatedKit.questions.map((question) => [question.id, question])
          );

          const orderedQuestions = builderState.questionOrder
            .map((questionId) => questionsById.get(questionId))
            .filter(
              (question): question is (typeof validatedKit.questions)[number] =>
                question !== undefined
            );

          const orderedIds = new Set(
            orderedQuestions.map((question) => question.id)
          );

          const newQuestions = validatedKit.questions.filter(
            (question) => !orderedIds.has(question.id)
          );

          validatedKit.questions = [...orderedQuestions, ...newQuestions];
        }

        const remainingQuestionRequirementIds = new Set(
          validatedKit.questions
            .map((question) => question.requirement_ids)
            .flat()
        );

        validatedKit.coverage.uncovered_requirement_ids =
          validatedKit.role.requirements
            .filter(
              (requirement) =>
                !remainingQuestionRequirementIds.has(requirement.id)
            )
            .map((requirement) => requirement.id);

        kit.data = validatedKit;
        kit.builderState = builderState;
        kit.status = "ready";

        kit.markModified("data");
        kit.markModified("builderState");

        await kit.save();

        return response.status(200).json({
          status: "ready",
          data: kit.data,
          builderState: kit.builderState,
        });
      } catch (error) {
        kit.status = "failed";

        await kit.save();

        console.error("Kit generation failed:", error);

        return response.status(500).json({
          error: {
            code: "GENERATION_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Interview kit generation failed.",
          },
        });
      }
    } catch (error) {
      return next(error);
    }
  }
);

kitsRouter.post(
  "/",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const {
        name,
        jobDescription,
        companyUrl,
        daysAvailable,
      } = createKitSchema.parse(request.body);

      const kit = await Kit.create({
        ownerId: request.userId,
        name,
        jobDescription,
        companyUrl,
        daysAvailable,
      });

      return response.status(201).json({ kit });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return response.status(400).json({
          error: {
            code: "INVALID_KIT",
            message:
              error.issues[0]?.message ?? "Invalid kit.",
          },
        });
      }

      return next(error);
    }
  }
);