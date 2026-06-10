"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteInteractionNotification = exports.createNotification = exports.extractMentions = void 0;
const notification_model_1 = __importDefault(require("../models/notification.model"));
const user_model_1 = require("../models/user.model");
const socket_1 = require("../configs/socket");
const logger_1 = require("./logger");
const extractMentions = async (text) => {
    const mentionRegex = /@(\w+)/g;
    const matches = [...text.matchAll(mentionRegex)];
    const usernames = matches.map(match => match[1]?.toLowerCase() || "").filter(Boolean);
    if (usernames.length === 0)
        return [];
    const users = await user_model_1.User.find({ username: { $in: usernames } }).select("_id").lean();
    return users.map((user) => user._id.toString());
};
exports.extractMentions = extractMentions;
const createNotification = async ({ recipient, sender, type, post, comment, }) => {
    try {
        // prevent self notifications
        if (recipient.toString() === sender.toString()) {
            return null;
        }
        // notifications
        const notification = await notification_model_1.default.create({
            recipient,
            sender,
            type,
            post: post || null,
            comment: comment || null,
        });
        // populate notification for socket
        const populatedNotification = await notification_model_1.default.findById(notification._id)
            .populate("sender", "fullName username profilePic")
            .lean();
        if (populatedNotification) {
            (0, socket_1.sendNotification)(recipient.toString(), populatedNotification);
        }
        return notification;
    }
    catch (err) {
        logger_1.logger.error(`Error in createNotification utility!`, { error: err.message });
        return null;
    }
};
exports.createNotification = createNotification;
const deleteInteractionNotification = async ({ recipient, sender, type, post, comment, }) => {
    try {
        const filter = {
            recipient,
            sender,
            type,
        };
        if (post !== undefined) {
            filter.post = post;
        }
        if (comment !== undefined) {
            filter.comment = comment;
        }
        await notification_model_1.default.deleteMany(filter);
    }
    catch (err) {
        logger_1.logger.error(`Error in deleteInteractionNotification utility!`, { error: err.message });
    }
};
exports.deleteInteractionNotification = deleteInteractionNotification;
//# sourceMappingURL=notification.js.map