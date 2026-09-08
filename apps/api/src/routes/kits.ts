import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middleware/require-auth.js";
import { Kit } from "../models/kit.js";

const createKitSchema = z.object({ name: z.string().trim().min(1).max(120) });

export const kitsRouter = Router();
kitsRouter.use(requireAuth);

kitsRouter.get("/", async (request: AuthenticatedRequest, response, next) => {
  try {
    const kits = await Kit.find({ ownerId: request.userId }).sort({ updatedAt: -1 }).select("name status createdAt updatedAt");
    return response.json({ kits });
  } catch (error) {
    return next(error);
  }
});

kitsRouter.post("/", async (request: AuthenticatedRequest, response, next) => {
  try {
    const { name } = createKitSchema.parse(request.body);
    const kit = await Kit.create({ ownerId: request.userId, name });
    return response.status(201).json({ kit });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return response.status(400).json({ error: { code: "INVALID_KIT", message: error.issues[0]?.message ?? "Invalid kit." } });
    }
    return next(error);
  }
});
