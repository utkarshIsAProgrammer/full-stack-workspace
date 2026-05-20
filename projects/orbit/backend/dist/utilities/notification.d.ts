type NotificationType = "like" | "comment" | "follow" | "repost" | "save";
type NotificationParams = {
    recipient: string;
    sender: string;
    type: NotificationType;
    post?: string | null;
    comment?: string | null;
};
type CreateNotificationParams = NotificationParams;
type DeleteNotificationParams = NotificationParams;
export declare const createNotification: ({ recipient, sender, type, post, comment, }: CreateNotificationParams) => Promise<(import("mongoose").Document<unknown, {}, {
    type: "save" | "comment" | "like" | "follow" | "repost";
    sender: import("mongoose").Types.ObjectId;
    recipient: import("mongoose").Types.ObjectId;
    isRead: boolean;
    comment?: import("mongoose").Types.ObjectId | null;
    post?: import("mongoose").Types.ObjectId | null;
} & import("mongoose").DefaultTimestampProps, {
    id: string;
}, {
    timestamps: true;
}> & Omit<{
    type: "save" | "comment" | "like" | "follow" | "repost";
    sender: import("mongoose").Types.ObjectId;
    recipient: import("mongoose").Types.ObjectId;
    isRead: boolean;
    comment?: import("mongoose").Types.ObjectId | null;
    post?: import("mongoose").Types.ObjectId | null;
} & import("mongoose").DefaultTimestampProps & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}) | null>;
export declare const deleteInteractionNotification: ({ recipient, sender, type, post, comment, }: DeleteNotificationParams) => Promise<void>;
export {};
//# sourceMappingURL=notification.d.ts.map