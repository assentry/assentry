import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  clearLoginFailures,
  clientIp,
  loginAllowed,
  passwordMatches,
  recordLoginFailure,
  signupAllowed,
  TOO_MANY_ATTEMPTS,
  TOO_MANY_SIGNUPS,
} from "../lib/security";
import { AuthedRequest, requireUser, signUserSession } from "../lib/userAuth";

export const authRouter = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

authRouter.post("/signup", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, password, name } = parsed.data;
  if (!(await signupAllowed(clientIp(req)))) return res.status(429).json({ error: TOO_MANY_SIGNUPS });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { email, passwordHash, name } }).catch((err) => {
    if ((err as { code?: string }).code === "P2002") return null;
    throw err;
  });
  if (!user) return res.status(409).json({ error: "email already registered" });

  const token = signUserSession(user.id, user.sessionVersion);
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
  });
});

authRouter.post("/login", async (req, res) => {
  const parsed = credentialsSchema
    .pick({ email: true, password: true })
    .safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, password } = parsed.data;
  const ip = clientIp(req);
  if (!(await loginAllowed(email, ip))) return res.status(429).json({ error: TOO_MANY_ATTEMPTS });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!(await passwordMatches(user?.passwordHash, password)) || !user) {
    await recordLoginFailure(email, ip);
    return res.status(401).json({ error: "invalid email or password" });
  }
  await clearLoginFailures(email);

  const token = signUserSession(user.id, user.sessionVersion);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

// Lets the frontend restore a session from a stored token alone, without
// re-sending credentials.
authRouter.get("/me", requireUser, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return res.status(401).json({ error: "user not found" });
  res.json({ user: { id: user.id, email: user.email, name: user.name } });
});

// Ends every session this person has, on every device, including this one.
authRouter.post("/logout-everywhere", requireUser, async (req: AuthedRequest, res) => {
  await prisma.user.update({ where: { id: req.userId! }, data: { sessionVersion: { increment: 1 } } });
  await prisma.auditLog.create({
    data: { userId: req.userId!, action: "logged_out_everywhere", result: "allowed", reason: "user_requested", metadata: {} },
  });
  res.json({ ok: true });
});
