import cors from "cors";
import express from "express";

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000" }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  return app;
}
