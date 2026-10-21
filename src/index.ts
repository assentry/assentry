import cors from "cors";
import "dotenv/config";
import express from "express";
import { agentsRouter } from "./routes/agents";
import { auditRouter } from "./routes/audit";
import { authRouter } from "./routes/auth";
import { grantsRouter } from "./routes/grants";
import { profileRouter } from "./routes/profile";
import { verifyRouter } from "./routes/verify";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.get("/health", (_req, res) => res.json({ ok: true }));

// User-facing (personal app), session-authenticated.
app.use("/auth", authRouter);
app.use("/agents", agentsRouter);
app.use("/grants", grantsRouter);
app.use("/audit", auditRouter);

// Partner-facing (business SDK), API-key authenticated.
app.use("/verify", verifyRouter);
app.use("/profile", profileRouter);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`HAPI core listening on http://localhost:${port}`);
});
