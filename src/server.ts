import "dotenv/config";
import { createDatabase } from "./db.js";
import { createApp } from "./app.js";

const db = createDatabase(process.env.DATABASE_PATH ?? "./data/rehook.db");
const app = createApp(db, {
  maxBodyBytes: Number(process.env.MAX_BODY_BYTES) || 1048576,
  replayTimeoutMs: Number(process.env.REPLAY_TIMEOUT_MS) || 10000,
  allowPrivateReplay: process.env.ALLOW_PRIVATE_REPLAY === "true"
});
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`ReHook listening on http://localhost:${port}`));
