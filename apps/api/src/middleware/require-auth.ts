import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export function requireAuth(request: AuthenticatedRequest, response: Response, next: NextFunction) {
  const secret = process.env.SESSION_SECRET;
  const token = request.cookies.session;

  if (!secret || !token) {
    return response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Please sign in." } });
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    if (!payload.sub) {
      throw new Error("Token has no subject");
    }

    request.userId = payload.sub;
    return next();
  } catch {
    return response.status(401).json({ error: { code: "INVALID_SESSION", message: "Your session has expired. Please sign in again." } });
  }
}
