import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthedRequest, requireUser } from "../lib/userAuth";

export const auditRouter = Router();
auditRouter.use(requireUser);

auditRouter.get("/", async (req: AuthedRequest, res) => {
  const logs = await prisma.auditLog.findMany({
    where: { userId: req.userId! },
    include: { agent: true, grant: true, partner: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json({ logs });
});
