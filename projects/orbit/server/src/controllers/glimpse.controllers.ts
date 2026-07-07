import mongoose from "mongoose";
import type { Request, Response } from "express";
import Glimpse from "../models/glimpse.model";
import cloudinary from "../configs/cloudinary";
import { AppError, BadRequestError, NotFoundError, UnauthorizedError } from "../utilities/errors";
import { logger } from "../utilities/logger";
import { getIO } from "../configs/socket";

// Get glimpse feed for the current user
// Returns non-expired glimpses that still have remaining views
export const getGlimpseFeed = async (req: Request, res: Response) => {
  const currentUserId = req.user?._id?.toString();

  try {
    if (!currentUserId) {
      throw new UnauthorizedError("Unauthorized!");
    }

    const now = new Date();
    // Return glances that still have views remaining OR were authored by the current user (for stats)
    const glimpses = await Glimpse.find({
      expiresAt: { $gt: now },
      $or: [
        { $expr: { $lt: [{ $size: "$viewers" }, "$maxViews"] } },
        { author: new mongoose.Types.ObjectId(currentUserId) },
      ],
    })
      .populate("author", "username fullName profilePic")
      .populate("viewers.user", "username fullName profilePic")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean({ virtuals: true });

    // Enrich with per-user view status
    const enriched = glimpses.map((g) => ({
      ...g,
      viewedByMe: (g.viewers || []).some(
        (v: any) => v.user?.toString() === currentUserId
      ),
      viewsRemaining: Math.max(0, g.maxViews - (g.viewers?.length || 0)),
    }));

    return res.status(200).json({
      success: true,
      glimpses: enriched,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in getGlimpseFeed controller!", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// Create a new glimpse
export const createGlimpse = async (req: Request, res: Response) => {
  const author = req.user?._id;

  try {
    if (!author) {
      throw new UnauthorizedError("Unauthorized!");
    }

    const file = req.file;
    if (!file) {
      throw new BadRequestError("Media is required for a glimpse!");
    }

    const isVideo = file.mimetype.startsWith("video/");

    const glimpse = new Glimpse({
      author,
      media: {
        url: file.path,
        public_id: (file as any).filename,
      },
      mediaType: isVideo ? "video" : "image",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await glimpse.save();

    const populated = await Glimpse.findById(glimpse._id)
      .populate("author", "username fullName profilePic")
      .populate("viewers.user", "username fullName profilePic")
      .lean({ virtuals: true });

    const enrichedGlimpse = {
      ...populated,
      viewedByMe: false,
      viewsRemaining: 2,
    };

    // Broadcast via socket
    try {
      const io = getIO();
      io.emit("glimpse:created", enrichedGlimpse);
    } catch (socketErr: any) {
      logger.warn("Failed to broadcast glimpse:created via socket", {
        error: socketErr.message,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Glimpse created successfully!",
      glimpse: enrichedGlimpse,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in createGlimpse controller!", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// Helper: delete a glimpse and clean up Cloudinary image
const deleteGlimpseAndCleanup = async (glimpse: any) => {
  if (glimpse?.media?.public_id) {
    const resourceType = glimpse.mediaType === "video" ? "video" : "image";
    cloudinary.uploader.destroy(glimpse.media.public_id, { resource_type: resourceType }).catch((err: any) => {
      logger.warn("Failed to delete Cloudinary media for glimpse", {
        error: err?.message,
        public_id: glimpse.media.public_id,
      });
    });
  }
  await Glimpse.findByIdAndDelete(glimpse._id);
};

// Mark a glimpse as viewed by the current user
// Uses atomic findOneAndUpdate to prevent race conditions on the 2-viewer limit
export const viewGlimpse = async (req: Request, res: Response) => {
  const glimpseId = req.params.glimpseId as string;
  const currentUserId = String(req.user?._id || "");

  try {
    if (!currentUserId) {
      throw new UnauthorizedError("Unauthorized!");
    }

    if (!mongoose.Types.ObjectId.isValid(glimpseId)) {
      throw new BadRequestError("Invalid glimpse ID!");
    }

    // Check if already viewed (lightweight read-only check)
    const existingGlimpse = await Glimpse.findById(glimpseId).select("author viewers expiresAt maxViews media");
    if (!existingGlimpse) {
      throw new NotFoundError("Glimpse not found!");
    }

    if (existingGlimpse.expiresAt < new Date()) {
      await deleteGlimpseAndCleanup(existingGlimpse);
      try { getIO().emit("glimpse:expired", { glimpseId }); } catch {}
      throw new BadRequestError("Glimpse has expired!");
    }

    // Prevent the author from being recorded as a viewer of their own glance
    const isAuthorViewing = existingGlimpse.author?.toString() === currentUserId;
    if (isAuthorViewing) {
      return res.status(200).json({
        success: true,
        message: "Authors cannot view their own glance!",
        isAuthor: true,
      });
    }

    const alreadyViewed = existingGlimpse.viewers.some(
      (v: any) => v.user?.toString() === currentUserId
    );
    if (alreadyViewed) {
      return res.status(200).json({
        success: true,
        message: "Already viewed!",
        alreadyViewed: true,
      });
    }

    // Atomic update: only push viewer if current count < maxViews AND user hasn't viewed
    // Using findOneAndUpdate with $expr filter to prevent race condition
    const updatedGlimpse = await Glimpse.findOneAndUpdate(
      {
        _id: glimpseId,
        expiresAt: { $gt: new Date() },
        $expr: { $lt: [{ $size: "$viewers" }, "$maxViews"] },
        "viewers.user": { $ne: new mongoose.Types.ObjectId(String(currentUserId)) },
      },
      {
        $push: {
          viewers: {
            user: new mongoose.Types.ObjectId(String(currentUserId)),
            viewedAt: new Date(),
          },
        },
      },
      { returnDocument: 'after' }
    );

    // If the atomic update didn't match, the glimpse is either expired or fully consumed
    if (!updatedGlimpse) {
      // Re-check why it failed — could be fully consumed
      const currentGlimpse = await Glimpse.findById(glimpseId).select("viewers maxViews media");
      if (currentGlimpse && currentGlimpse.viewers.length >= currentGlimpse.maxViews) {
        await deleteGlimpseAndCleanup(currentGlimpse);
        try { getIO().emit("glimpse:expired", { glimpseId }); } catch {}
        throw new BadRequestError("Glimpse has already reached maximum views!");
      }
      throw new BadRequestError("Could not view glimpse — it may have expired or been fully viewed!");
    }

    const remainingViews = updatedGlimpse.maxViews - updatedGlimpse.viewers.length;
    const viewers = updatedGlimpse.viewers.map((v: any) => ({
      user: v.user?.toString() || "",
      viewedAt: v.viewedAt,
    }));

    // Socket broadcasts
    try {
      const io = getIO();

      if (remainingViews === 0) {
        // Fully viewed — do not delete instantly so the active viewer is not kicked out.
      } else if (remainingViews === 1) {
        io.emit("glimpse:one-view-left", {
          glimpseId,
          authorId: updatedGlimpse.author.toString(),
          remainingViews: 1,
        });
      }

      io.emit("glimpse:viewed", {
        glimpseId,
        viewerId: currentUserId,
        remainingViews,
        viewers,
      });
    } catch (socketErr: any) {
      logger.warn("Failed to emit glimpse socket events", {
        error: socketErr.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Glimpse viewed!",
      remainingViews,
      alreadyViewed: false,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in viewGlimpse controller!", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// Get a single glimpse by ID
export const getGlimpse = async (req: Request, res: Response) => {
  const glimpseId = req.params.glimpseId as string;
  const currentUserId = String(req.user?._id || "");

  try {
    if (!currentUserId) {
      throw new UnauthorizedError("Unauthorized!");
    }

    if (!mongoose.Types.ObjectId.isValid(glimpseId)) {
      throw new BadRequestError("Invalid glimpse ID!");
    }

    const glimpse = await Glimpse.findById(glimpseId)
      .populate("author", "username fullName profilePic")
      .lean({ virtuals: true });

    if (!glimpse) {
      throw new NotFoundError("Glimpse not found!");
    }

    const enriched = {
      ...glimpse,
      viewedByMe: (glimpse.viewers || []).some(
        (v: any) => v.user?.toString() === currentUserId
      ),
      viewsRemaining: Math.max(0, glimpse.maxViews - (glimpse.viewers?.length || 0)),
    };

    return res.status(200).json({
      success: true,
      glimpse: enriched,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in getGlimpse controller!", { error: err.message });
    throw new AppError("Internal server error!");
  }
};
