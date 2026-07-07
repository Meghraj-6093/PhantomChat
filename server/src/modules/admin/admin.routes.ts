import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./admin.service";

export const adminRouter = Router();
adminRouter.use(requireAuth);

// Any signed-in user can file a report.
adminRouter.post(
  "/reports",
  validate({
    body: z.object({
      targetId: z.string().min(1),
      messageId: z.string().optional(),
      reason: z.string().min(3).max(500),
    }),
  }),
  asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await service.createReport(req.auth!.sub, req.body) });
  })
);

// Everything below is staff-only.
adminRouter.use(requireRole("ADMIN", "MODERATOR"));

adminRouter.get("/stats", asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await service.getStats() });
}));

adminRouter.get("/users", asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.listUsers({
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      page: typeof req.query.page === "string" ? parseInt(req.query.page, 10) : undefined,
      pageSize: typeof req.query.pageSize === "string" ? parseInt(req.query.pageSize, 10) : undefined,
    }),
  });
}));

adminRouter.post(
  "/users/:userId/ban",
  validate({ body: z.object({ banned: z.boolean(), reason: z.string().max(300).optional() }) }),
  asyncHandler(async (req, res) => {
    await service.setBan(req.auth!.sub, req.params.userId!, req.body.banned, req.body.reason);
    res.json({ success: true, data: null });
  })
);

adminRouter.post(
  "/users/:userId/role",
  requireRole("ADMIN"),
  validate({ body: z.object({ role: z.enum(["USER", "MODERATOR", "ADMIN"]) }) }),
  asyncHandler(async (req, res) => {
    await service.setRole(req.auth!.sub, req.params.userId!, req.body.role);
    res.json({ success: true, data: null });
  })
);

adminRouter.get("/reports", asyncHandler(async (req, res) => {
  const status = req.query.status;
  res.json({
    success: true,
    data: await service.listReports(
      typeof status === "string" && ["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"].includes(status)
        ? (status as "OPEN")
        : undefined
    ),
  });
}));

adminRouter.post(
  "/reports/:reportId",
  validate({ body: z.object({ status: z.enum(["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"]) }) }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.resolveReport(req.auth!.sub, req.params.reportId!, req.body.status) });
  })
);

adminRouter.get("/audit-logs", asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await service.listAuditLogs() });
}));

adminRouter.delete("/messages/:messageId", asyncHandler(async (req, res) => {
  await service.adminDeleteMessage(req.auth!.sub, req.params.messageId!);
  res.json({ success: true, data: null });
}));
