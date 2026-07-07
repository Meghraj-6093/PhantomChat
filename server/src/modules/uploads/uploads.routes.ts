import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { upload } from "../../middleware/upload";
import { uploadLimiter } from "../../middleware/rateLimit";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { cloudinary, cloudinaryEnabled } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import type { UploadApiResponse } from "cloudinary";

function uploadBuffer(buffer: Buffer, options: Record<string, unknown>): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err || !result) reject(err ?? new Error("Upload failed"));
      else resolve(result);
    });
    stream.end(buffer);
  });
}

function resourceType(mime: string): "image" | "video" | "raw" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/") || mime.startsWith("audio/")) return "video";
  return "raw";
}

export const uploadsRouter = Router();
uploadsRouter.use(requireAuth, uploadLimiter);

/**
 * POST /api/uploads — multipart form with up to 5 `files`.
 * Returns attachment records to link into a message via `attachmentIds`.
 */
uploadsRouter.post("/", upload.array("files", 5), asyncHandler(async (req, res) => {
  if (!cloudinaryEnabled) throw ApiError.badRequest("Media uploads are not configured (missing Cloudinary env vars)");
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) throw ApiError.badRequest("No files provided");

  const attachments = await Promise.all(
    files.map(async (file) => {
      const result = await uploadBuffer(file.buffer, {
        folder: `phantomchat/${req.auth!.sub}`,
        resource_type: resourceType(file.mimetype),
        // Let Cloudinary optimize images automatically.
        ...(file.mimetype.startsWith("image/") ? { quality: "auto", fetch_format: "auto" } : {}),
      });
      return prisma.attachment.create({
        data: {
          uploaderId: req.auth!.sub,
          url: result.url,
          secureUrl: result.secure_url,
          publicId: result.public_id,
          mimeType: file.mimetype,
          fileName: file.originalname.slice(0, 255),
          sizeBytes: file.size,
          width: result.width ?? null,
          height: result.height ?? null,
          durationMs: result.duration ? Math.round(result.duration * 1000) : null,
        },
      });
    })
  );

  res.status(201).json({ success: true, data: attachments });
}));
