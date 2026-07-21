import type { Request, Response } from "express";
import mongoose from "mongoose";
import crypto from "crypto";
import { Webhook } from "../models/webhook.model";
import { AppError, BadRequestError, NotFoundError, UnauthorizedError } from "../utilities/errors";
import { logger } from "../utilities/logger";

/**
 * POST /api/webhooks — Register a new webhook.
 */
export const createWebhook = async (req: Request, res: Response) => {
  const currentUserId = req.user?._id;
  const url = typeof req.body.url === "string" ? req.body.url : "";
  const events = req.body.events as string[] | undefined;

  try {
    if (!currentUserId) throw new UnauthorizedError("Unauthorized!");
    if (!url || !url.trim()) throw new BadRequestError("URL is required!");
    if (!events || !Array.isArray(events) || events.length === 0) {
      throw new BadRequestError("At least one event is required!");
    }

    const validEvents = ["post.created", "post.liked", "post.commented", "user.followed", "comment.created"];
    const invalidEvents = events.filter((e: string) => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      throw new BadRequestError(`Invalid events: ${invalidEvents.join(", ")}`);
    }

    const webhook = new Webhook({
      user: currentUserId,
      url: url.trim(),
      events,
    });

    await webhook.save();

    return res.status(201).json({
      success: true,
      message: "Webhook created! Save the secret — it won't be shown again.",
      webhook: {
        _id: webhook._id,
        url: webhook.url,
        events: webhook.events,
        secret: webhook.secret,
        isActive: webhook.isActive,
      },
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in createWebhook", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

/**
 * GET /api/webhooks — List webhooks for the current user.
 */
export const getWebhooks = async (req: Request, res: Response) => {
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) throw new UnauthorizedError("Unauthorized!");

    const webhooks = await Webhook.find({ user: currentUserId })
      .select("-secret")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, webhooks });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in getWebhooks", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

/**
 * DELETE /api/webhooks/:webhookId — Delete a webhook.
 */
export const deleteWebhook = async (req: Request, res: Response) => {
  const webhookId = req.params.webhookId as string;
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) throw new UnauthorizedError("Unauthorized!");
    if (!mongoose.Types.ObjectId.isValid(webhookId)) throw new BadRequestError("Invalid webhook ID!");

    const webhook = await Webhook.findOneAndDelete({ _id: webhookId, user: currentUserId });
    if (!webhook) throw new NotFoundError("Webhook not found!");

    return res.status(200).json({ success: true, message: "Webhook deleted!" });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in deleteWebhook", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

/**
 * POST /api/webhooks/:webhookId/test — Send a test payload.
 */
export const testWebhook = async (req: Request, res: Response) => {
  const { webhookId } = req.params;
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) throw new UnauthorizedError("Unauthorized!");

    const webhook = await Webhook.findOne({ _id: webhookId, user: currentUserId });
    if (!webhook) throw new NotFoundError("Webhook not found!");

    const payload = {
      event: "test",
      timestamp: new Date().toISOString(),
      data: { message: "This is a test webhook payload from ORBIT" },
    };

    const signature = crypto
      .createHmac("sha256", webhook.secret)
      .update(JSON.stringify(payload))
      .digest("hex");

    // Fire-and-forget: send the test payload
    fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": "test",
      },
      body: JSON.stringify(payload),
    }).catch((err) => logger.error("Test webhook delivery failed", { error: err.message }));

    return res.status(200).json({ success: true, message: "Test payload sent!" });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in testWebhook", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

/**
 * Deliver a webhook event (called from controllers after relevant actions).
 */
export const deliverWebhookEvent = async (event: string, data: any) => {
  try {
    const webhooks = await Webhook.find({ events: event, isActive: true }).lean();
    if (webhooks.length === 0) return;

    const payload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    const body = JSON.stringify(payload);

    for (const wh of webhooks) {
      const signature = crypto
        .createHmac("sha256", wh.secret)
        .update(body)
        .digest("hex");

      fetch(wh.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Event": event,
        },
        body,
      })
        .then(async (res) => {
          await Webhook.findByIdAndUpdate(wh._id, {
            lastTriggeredAt: new Date(),
            failureCount: res.ok ? 0 : (wh.failureCount || 0) + 1,
          });
        })
        .catch(async () => {
          await Webhook.findByIdAndUpdate(wh._id, {
            failureCount: (wh.failureCount || 0) + 1,
          });
        });
    }
  } catch (err: any) {
    logger.error("Error delivering webhook event", { error: err.message, event });
  }
};
