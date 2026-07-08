import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./messages.service";

const sendSchema = z.object({
  type: z.enum(["TEXT", "IMAGE", "VIDEO", "AUDIO", "FILE", "VOICE", "GIF", "STICKER"]).optional(),
  // Plaintext is capped at 4000 chars; an encrypted envelope (ciphertext plus a
  // wrapped key per group member) is larger, so allow more when isEncrypted.
  content: z.string().max(60000).optional(),
  isEncrypted: z.boolean().optional(),
  replyToId: z.string().optional(),
  threadRootId: z.string().optional(),
  attachmentIds: z.array(z.string()).max(5).optional(),
  scheduledFor: z.string().datetime().optional(),
});

// mergeParams so :chatId from the parent chats router is visible here.
export const messagesRouter = Router({ mergeParams: true });
messagesRouter.use(requireAuth);

const chatId = (req: { params: Record<string, string | undefined> }) => req.params.chatId!;

messagesRouter.get("/", asyncHandler(async (req, res) => {
  const { cursor, limit, threadRootId } = req.query;
  res.json({
    success: true,
    data: await service.listMessages(chatId(req), req.auth!.sub, {
      cursor: typeof cursor === "string" ? cursor : undefined,
      limit: typeof limit === "string" ? parseInt(limit, 10) : undefined,
      threadRootId: typeof threadRootId === "string" ? threadRootId : undefined,
    }),
  });
}));

messagesRouter.post("/", validate({ body: sendSchema }), asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await service.sendMessage(chatId(req), req.auth!.sub, req.body) });
}));

messagesRouter.get("/search", validate({ query: z.object({ q: z.string().min(1).max(200) }) }), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.searchMessages(chatId(req), req.auth!.sub, String(req.query.q)) });
}));

messagesRouter.get("/pins", asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.listPins(chatId(req), req.auth!.sub) });
}));

messagesRouter.get("/media", asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.listMedia(chatId(req), req.auth!.sub) });
}));

messagesRouter.patch(
  "/:messageId",
  validate({ body: z.object({ content: z.string().min(1).max(60000) }) }),
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: await service.editMessage(chatId(req), req.params.messageId!, req.auth!.sub, req.body.content),
    });
  })
);

messagesRouter.delete("/:messageId", asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.deleteMessage(chatId(req), req.params.messageId!, req.auth!.sub) });
}));

messagesRouter.post(
  "/:messageId/reactions",
  validate({ body: z.object({ emoji: z.string().min(1).max(16) }) }),
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: await service.toggleReaction(chatId(req), req.params.messageId!, req.auth!.sub, req.body.emoji),
    });
  })
);

messagesRouter.post("/:messageId/pin", asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.pinMessage(chatId(req), req.params.messageId!, req.auth!.sub) });
}));

messagesRouter.delete("/:messageId/pin", asyncHandler(async (req, res) => {
  await service.unpinMessage(chatId(req), req.params.messageId!, req.auth!.sub);
  res.json({ success: true, data: null });
}));

messagesRouter.post("/:messageId/read", asyncHandler(async (req, res) => {
  await service.markRead(chatId(req), req.auth!.sub, req.params.messageId!);
  res.json({ success: true, data: null });
}));

messagesRouter.post(
  "/:messageId/forward",
  validate({ body: z.object({ targetChatIds: z.array(z.string()).min(1).max(10) }) }),
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: await service.forwardMessage(req.auth!.sub, req.params.messageId!, req.body.targetChatIds),
    });
  })
);
