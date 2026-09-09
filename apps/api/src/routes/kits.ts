import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middleware/require-auth.js";
import { Kit } from "../models/kit.js";
import { extractRequirements } from "../services/requirement-extractor.js";
import { researchCompany } from "../services/researcher.js";
import { generateCompanyBrief } from "../services/company-brief-generator.js";

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
  "/:id/research",
  async (request: AuthenticatedRequest, response, next) => {
    try {
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

      const research = await researchCompany(kit.companyUrl);

      return response.json({
        research,
      });
    } catch (error) {
      return next(error);
    }
  }
);

kitsRouter.post(
  "/:id/company-brief",
  async (request: AuthenticatedRequest, response, next) => {
    try {
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

      const research = await researchCompany(kit.companyUrl);

      const companyBrief = await generateCompanyBrief(
        kit.companyUrl,
        research
      );

      return response.json({
        companyBrief,
        research,
      });
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

kitsRouter.post(
  "/:id/generate-requirements",
  async (request: AuthenticatedRequest, response, next) => {
    try {
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

      kit.status = "generating";
      await kit.save();

      try {
        const requirements = await extractRequirements(kit.jobDescription);

        kit.data = {
          ...(kit.data ?? {}),
          role: {
            ...((kit.data as { role?: Record<string, unknown> } | null)
              ?.role ?? {}),
            requirements,
          },
        };

        kit.status = "ready";
        await kit.save();

        return response.json({
          kit: {
            id: kit._id,
            status: kit.status,
            requirements,
          },
        });
      } catch (error) {
        kit.status = "failed";
        await kit.save();

        throw error;
      }
    } catch (error) {
      return next(error);
    }
  }
);
