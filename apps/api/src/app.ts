import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import { authRouter } from "./routes/auth.js";
import { kitsRouter } from "./routes/kits.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000", credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  app.use("/auth", authRouter);
  app.use("/kits", kitsRouter);

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error(error);
    response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong." } });
  });

  return app;
}
