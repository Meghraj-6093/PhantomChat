import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import * as chatsService from "./chats.service";
import { messagesRouter } from "../messages/messages.routes";

const createGroupSchema = z.object({
  type: z.enum(["GROUP", "CHANNEL"]),
  name: z.string().min(1).max(64),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
  memberIds: z.array(z.string()).max(100).optional(),
});

const updateChatSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.string().max(500).optional(),
  avatarUrl: z.string().url().max(500).optional(),
  isPublic: z.boolean().optional(),
  slowModeSeconds: z.number().int().min(0).max(3600).optional(),
});

export const chatsRouter = Router();
chatsRouter.use(requireAuth);

chatsRouter.get("/", asyncHandler(async (req, res) => {
  res.json({ success: true, data: await chatsService.listMyChats(req.auth!.sub) });
}));

chatsRouter.get("/discover", asyncHandler(async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  res.json({ success: true, data: await chatsService.discoverPublic(q) });
}));

chatsRouter.post(
  "/dm",
  validate({ body: z.object({ userId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await chatsService.getOrCreateDm(req.auth!.sub, req.body.userId) });
  })
);

chatsRouter.post("/", validate({ body: createGroupSchema }), asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await chatsService.createGroup(req.auth!.sub, req.body) });
}));

chatsRouter.get("/:chatId", asyncHandler(async (req, res) => {
  res.json({ success: true, data: await chatsService.getChat(req.params.chatId!, req.auth!.sub) });
}));

chatsRouter.patch("/:chatId", validate({ body: updateChatSchema }), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await chatsService.updateChat(req.params.chatId!, req.auth!.sub, req.body) });
}));

chatsRouter.delete("/:chatId", asyncHandler(async (req, res) => {
  await chatsService.deleteChat(req.params.chatId!, req.auth!.sub);
  res.json({ success: true, data: null });
}));

chatsRouter.post("/:chatId/join", asyncHandler(async (req, res) => {
  res.json({ success: true, data: await chatsService.joinPublicChat(req.params.chatId!, req.auth!.sub) });
}));

chatsRouter.post("/:chatId/read", asyncHandler(async (req, res) => {
  await chatsService.markChatRead(req.params.chatId!, req.auth!.sub);
  res.json({ success: true, data: null });
}));

chatsRouter.post(
  "/:chatId/members",
  validate({ body: z.object({ memberIds: z.array(z.string()).min(1).max(100) }) }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await chatsService.addMembers(req.params.chatId!, req.auth!.sub, req.body.memberIds) });
  })
);

chatsRouter.delete("/:chatId/members/:userId", asyncHandler(async (req, res) => {
  await chatsService.removeMember(req.params.chatId!, req.auth!.sub, req.params.userId!);
  res.json({ success: true, data: null });
}));

chatsRouter.patch(
  "/:chatId/members/:userId/role",
  validate({ body: z.object({ role: z.enum(["ADMIN", "MODERATOR", "MEMBER"]) }) }),
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: await chatsService.setMemberRole(req.params.chatId!, req.auth!.sub, req.params.userId!, req.body.role),
    });
  })
);

// Nested message routes: /api/chats/:chatId/messages
chatsRouter.use("/:chatId/messages", messagesRouter);
