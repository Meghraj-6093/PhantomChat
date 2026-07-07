import { Router } from "express";
import { validate } from "../../middleware/validate";
import { requireAuth } from "../../middleware/auth";
import { authLimiter } from "../../middleware/rateLimit";
import * as controller from "./auth.controller";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  totpSchema,
  verifyEmailSchema,
} from "./auth.validation";

export const authRouter = Router();

authRouter.post("/register", authLimiter, validate({ body: registerSchema }), controller.register);
authRouter.post("/login", authLimiter, validate({ body: loginSchema }), controller.login);
authRouter.post("/refresh", controller.refresh);
authRouter.post("/logout", controller.logout);

authRouter.get("/sessions", requireAuth, controller.sessions);
authRouter.delete("/sessions", requireAuth, controller.revokeAllSessions);
authRouter.delete("/sessions/:id", requireAuth, controller.revokeSession);

authRouter.post("/verify-email/request", requireAuth, authLimiter, controller.requestVerifyEmail);
authRouter.post("/verify-email", validate({ body: verifyEmailSchema }), controller.verifyEmail);
authRouter.post("/forgot-password", authLimiter, validate({ body: forgotPasswordSchema }), controller.forgotPassword);
authRouter.post("/reset-password", authLimiter, validate({ body: resetPasswordSchema }), controller.resetPassword);

authRouter.post("/2fa/init", requireAuth, controller.initTwoFactor);
authRouter.post("/2fa/enable", requireAuth, validate({ body: totpSchema }), controller.enableTwoFactor);
authRouter.post("/2fa/disable", requireAuth, validate({ body: totpSchema }), controller.disableTwoFactor);

authRouter.get("/oauth/:provider", controller.oauthStart);
authRouter.post("/oauth/:provider/callback", authLimiter, controller.oauthCallback);
