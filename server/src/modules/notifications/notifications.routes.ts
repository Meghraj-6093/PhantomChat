import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./notifications.service";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get("/", asyncHandler(async (req, res) => {
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
  res.json({ success: true, data: await service.listNotifications(req.auth!.sub, cursor) });
}));

notificationsRouter.get("/unread-count", asyncHandler(async (req, res) => {
  res.json({ success: true, data: { count: await service.unreadCount(req.auth!.sub) } });
}));

notificationsRouter.post(
  "/read",
  validate({ body: z.object({ ids: z.array(z.string()).optional() }) }),
  asyncHandler(async (req, res) => {
    await service.markRead(req.auth!.sub, req.body.ids);
    res.json({ success: true, data: null });
  })
);

notificationsRouter.delete("/", asyncHandler(async (req, res) => {
  await service.clearAll(req.auth!.sub);
  res.json({ success: true, data: null });
}));
