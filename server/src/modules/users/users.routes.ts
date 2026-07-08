import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import * as usersService from "./users.service";

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(48).optional(),
  bio: z.string().max(300).optional(),
  statusText: z.string().max(120).optional(),
  avatarUrl: z.string().url().max(500).optional(),
  bannerUrl: z.string().url().max(500).optional(),
  status: z.enum(["ONLINE", "IDLE", "DND", "INVISIBLE"]).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().max(128).default(""),
  newPassword: z.string().min(8).max(128),
});

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get("/me", asyncHandler(async (req, res) => {
  res.json({ success: true, data: await usersService.getMe(req.auth!.sub) });
}));

usersRouter.patch("/me", validate({ body: updateProfileSchema }), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await usersService.updateProfile(req.auth!.sub, req.body) });
}));

usersRouter.post("/me/password", validate({ body: changePasswordSchema }), asyncHandler(async (req, res) => {
  await usersService.changePassword(req.auth!.sub, req.body.currentPassword, req.body.newPassword);
  res.json({ success: true, data: null });
}));

// ── End-to-end encryption keys ───────────────────────────────
usersRouter.get("/me/keys", asyncHandler(async (req, res) => {
  res.json({ success: true, data: await usersService.getMyKeys(req.auth!.sub) });
}));

const setKeysSchema = z.object({
  publicKey: z.string().min(1).max(2000),
  encryptedPrivateKey: z.string().min(1).max(8000),
});
usersRouter.put("/me/keys", validate({ body: setKeysSchema }), asyncHandler(async (req, res) => {
  await usersService.setMyKeys(req.auth!.sub, req.body.publicKey, req.body.encryptedPrivateKey);
  res.json({ success: true, data: null });
}));

usersRouter.get("/search", validate({ query: z.object({ q: z.string().min(1).max(64) }) }), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await usersService.searchUsers(String(req.query.q), req.auth!.sub) });
}));

usersRouter.get("/:username", asyncHandler(async (req, res) => {
  res.json({ success: true, data: await usersService.getByUsername(req.params.username!) });
}));
