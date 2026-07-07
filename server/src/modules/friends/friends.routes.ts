import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import * as friendsService from "./friends.service";

export const friendsRouter = Router();
friendsRouter.use(requireAuth);

friendsRouter.get("/", asyncHandler(async (req, res) => {
  res.json({ success: true, data: await friendsService.listFriends(req.auth!.sub) });
}));

friendsRouter.get("/pending", asyncHandler(async (req, res) => {
  res.json({ success: true, data: await friendsService.listPending(req.auth!.sub) });
}));

friendsRouter.get("/blocked", asyncHandler(async (req, res) => {
  res.json({ success: true, data: await friendsService.listBlocked(req.auth!.sub) });
}));

friendsRouter.post(
  "/requests",
  validate({ body: z.object({ username: z.string().min(3).max(24) }) }),
  asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await friendsService.sendRequest(req.auth!.sub, req.body.username) });
  })
);

friendsRouter.post(
  "/requests/:id/respond",
  validate({ body: z.object({ accept: z.boolean() }) }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await friendsService.respond(req.auth!.sub, req.params.id!, req.body.accept) });
  })
);

friendsRouter.delete("/:id", asyncHandler(async (req, res) => {
  await friendsService.removeFriend(req.auth!.sub, req.params.id!);
  res.json({ success: true, data: null });
}));

friendsRouter.post(
  "/block",
  validate({ body: z.object({ userId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await friendsService.blockUser(req.auth!.sub, req.body.userId) });
  })
);

friendsRouter.post(
  "/unblock",
  validate({ body: z.object({ userId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    await friendsService.unblockUser(req.auth!.sub, req.body.userId);
    res.json({ success: true, data: null });
  })
);
