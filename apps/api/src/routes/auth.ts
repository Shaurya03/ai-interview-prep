import bcrypt from "bcryptjs";
import { Router, type Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middleware/require-auth.js";
import { User } from "../models/user.js";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});

const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1_000;

function setSession(response: Response, userId: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required.");

  const token = jwt.sign({}, secret, { subject: userId, expiresIn: "7d" });
  response.cookie("session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: sessionLifetimeMs,
    path: "/",
  });
}

export const authRouter = Router();

authRouter.post("/register", async (request, response, next) => {
  try {
    const { email, password } = credentialsSchema.parse(request.body);
    const existingUser = await User.exists({ email: email.toLowerCase() });

    if (existingUser) {
      return response.status(409).json({ error: { code: "EMAIL_IN_USE", message: "An account with that email already exists." } });
    }

    const user = await User.create({ email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 12) });
    setSession(response, user.id);
    return response.status(201).json({ user: { id: user.id, email: user.email } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return response.status(400).json({ error: { code: "INVALID_CREDENTIALS", message: error.issues[0]?.message ?? "Invalid credentials." } });
    }
    return next(error);
  }
});

authRouter.post("/login", async (request, response, next) => {
  try {
    const { email, password } = credentialsSchema.parse(request.body);
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return response.status(401).json({ error: { code: "INVALID_LOGIN", message: "Email or password is incorrect." } });
    }

    setSession(response, user.id);
    return response.json({ user: { id: user.id, email: user.email } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return response.status(400).json({ error: { code: "INVALID_CREDENTIALS", message: error.issues[0]?.message ?? "Invalid credentials." } });
    }
    return next(error);
  }
});

authRouter.post("/logout", (_request, response) => {
  response.clearCookie("session", { httpOnly: true, sameSite: "lax", path: "/" });
  return response.status(204).send();
});

authRouter.get("/me", requireAuth, async (request: AuthenticatedRequest, response, next) => {
  try {
    const user = await User.findById(request.userId).select("email");
    if (!user) return response.status(401).json({ error: { code: "INVALID_SESSION", message: "Please sign in again." } });
    return response.json({ user: { id: user.id, email: user.email } });
  } catch (error) {
    return next(error);
  }
});
