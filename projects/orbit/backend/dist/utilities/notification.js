"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteInteractionNotification = exports.createNotification = void 0;
const notification_model_1 = __importDefault(require("../models/notification.model"));
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
        return notification;
    }
    catch (err) {
        console.log(`Error in createNotification utility! ${err.message}`);
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
        console.log(`Error in deleteInteractionNotification utility! ${err.message}`);
    }
};
exports.deleteInteractionNotification = deleteInteractionNotification;
//# sourceMappingURL=notification.js.map