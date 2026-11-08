import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthedRequest, requireUser } from "../lib/userAuth";

export const auditRouter = Router();
auditRouter.use(requireUser);

auditRouter.get("/", async (req: AuthedRequest, res) => {
  const logs = await prisma.auditLog.findMany({
    where: { userId: req.userId! },
    include: {
      agent: { select: { id: true, label: true, platform: true, revokedAt: true } },
      grant: { select: { id: true, consentedFields: true, expiresAt: true, revokedAt: true } },
      partner: { select: { id: true, name: true, domain: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json({ logs });
});
