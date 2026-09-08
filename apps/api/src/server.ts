import dotenv from "dotenv";
import { resolve } from "node:path";
import { createApp } from "./app.js";
import { connectToDatabase } from "./db.js";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });

const port = Number(process.env.PORT ?? 4000);
async function start() {
  await connectToDatabase();
  const app = createApp();

  app.listen(port, () => {
    console.info(`API listening on http://localhost:${port}`);
  });
}

start().catch((error: unknown) => {
  console.error("Could not start API", error);
  process.exitCode = 1;
});
