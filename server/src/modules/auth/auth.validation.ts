import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email().max(254),
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_\.]+$/, "Only letters, numbers, underscores and dots"),
  displayName: z.string().min(1).max(48),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  identifier: z.string().min(1).max(254), // email or username
  password: z.string().min(1).max(128),
  totp: z.string().length(6).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(128),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(10),
});

export const totpSchema = z.object({
  code: z.string().length(6),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
