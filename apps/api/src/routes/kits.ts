import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middleware/require-auth.js";
import { Kit } from "../models/kit.js";
import { generateKitDraft } from "../services/kit-generator.js";

const createKitSchema = z.object({
  name: z.string().trim().min(1).max(120),
  jobDescription: z.string().trim().min(1),
  companyUrl: z.string().trim().url(),
  daysAvailable: z.number().int().min(1).max(60),
});

export const kitsRouter = Router();
kitsRouter.use(requireAuth);

kitsRouter.get("/", async (request: AuthenticatedRequest, response, next) => {
  try {
    const kits = await Kit.find({ ownerId: request.userId }).sort({ updatedAt: -1 }).select("name companyUrl daysAvailable status createdAt updatedAt");
    return response.json({ kits });
  } catch (error) {
    return next(error);
  }
});

kitsRouter.get(
  "/:id",
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const kit = await Kit.findOne({
        _id: request.params.id,
        ownerId: request.userId,
      }).select(
        "name jobDescription companyUrl daysAvailable status data createdAt updatedAt"
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
            company: "",
            company_url: kit.companyUrl,
            role: draft.role.title,
            location: "",
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

        kit.data = data;
        kit.status = "ready";

        await kit.save();

        return response.status(200).json({
          status: "ready",
          data: kit.data,
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

kitsRouter.post("/", async (request: AuthenticatedRequest, response, next) => {
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
      return response.status(400).json({ error: { code: "INVALID_KIT", message: error.issues[0]?.message ?? "Invalid kit." } });
    }
    return next(error);
  }
});
