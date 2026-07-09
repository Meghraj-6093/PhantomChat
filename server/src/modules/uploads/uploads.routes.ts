import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { uploadLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { cloudinary, cloudinaryEnabled } from "../../lib/cloudinary";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";

// Kept in sync with the browser-side accept list. Enforced at registration
// time since the bytes no longer flow through this server (see below).
const ALLOWED_MIME = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
  "video/mp4", "video/webm", "video/quicktime",
  "audio/mpeg", "audio/ogg", "audio/webm", "audio/wav", "audio/mp4",
  "application/pdf", "application/zip", "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export const uploadsRouter = Router();
uploadsRouter.use(requireAuth, uploadLimiter);

/**
 * POST /api/uploads/sign — hand the browser short-lived signed params so it can
 * upload files *directly* to Cloudinary. This is the key to working on a
 * serverless host: Vercel caps a function's request body at ~4.5 MB, so routing
 * a phone photo or a video through the function would 413 before our code ran.
 * By uploading browser → Cloudinary, only tiny JSON ever touches the function.
 */
uploadsRouter.post(
  "/sign",
  asyncHandler(async (req, res) => {
    if (!cloudinaryEnabled) {
      throw ApiError.badRequest("Media uploads are not configured (missing Cloudinary env vars)");
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `phantomchat/${req.auth!.sub}`;
    const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, env.CLOUDINARY_API_SECRET!);
    res.json({
      success: true,
      data: {
        cloudName: env.CLOUDINARY_CLOUD_NAME,
        apiKey: env.CLOUDINARY_API_KEY,
        timestamp,
        folder,
        signature,
      },
    });
  })
);

const registerSchema = z.object({
  uploads: z
    .array(
      z.object({
        publicId: z.string().min(1).max(300),
        url: z.string().url(),
        secureUrl: z.string().url(),
        mimeType: z.string().min(1).max(255),
        fileName: z.string().min(1).max(255),
        sizeBytes: z.number().int().nonnegative(),
        width: z.number().int().positive().nullable().optional(),
        height: z.number().int().positive().nullable().optional(),
        durationMs: z.number().int().nonnegative().nullable().optional(),
      })
    )
    .min(1)
    .max(5),
});

/**
 * POST /api/uploads — register the results of the direct-to-Cloudinary uploads
 * as attachment records to link into a message via `attachmentIds`. This is a
 * small JSON payload; no file bytes pass through here.
 */
uploadsRouter.post(
  "/",
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    if (!cloudinaryEnabled) {
      throw ApiError.badRequest("Media uploads are not configured (missing Cloudinary env vars)");
    }
    const userId = req.auth!.sub;
    const folderPrefix = `phantomchat/${userId}/`;
    const { uploads } = req.body as z.infer<typeof registerSchema>;

    // The browser reports these values, so validate before trusting them: the
    // asset must live under this user's signed folder, and be an allowed type.
    for (const u of uploads) {
      if (!u.publicId.startsWith(folderPrefix)) throw ApiError.badRequest("Invalid upload reference");
      if (!ALLOWED_MIME.includes(u.mimeType)) throw ApiError.badRequest(`File type ${u.mimeType} is not allowed`);
    }

    const attachments = await Promise.all(
      uploads.map((u) =>
        prisma.attachment.create({
          data: {
            uploaderId: userId,
            url: u.url,
            secureUrl: u.secureUrl,
            publicId: u.publicId,
            mimeType: u.mimeType,
            fileName: u.fileName.slice(0, 255),
            sizeBytes: u.sizeBytes,
            width: u.width ?? null,
            height: u.height ?? null,
            durationMs: u.durationMs ?? null,
          },
        })
      )
    );

    res.status(201).json({ success: true, data: attachments });
  })
);
