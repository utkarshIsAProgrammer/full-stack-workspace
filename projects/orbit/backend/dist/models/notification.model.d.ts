import mongoose from "mongoose";
declare const Notification: mongoose.Model<{
    type: "save" | "comment" | "like" | "follow" | "repost";
    sender: mongoose.Types.ObjectId;
    recipient: mongoose.Types.ObjectId;
    isRead: boolean;
    comment?: mongoose.Types.ObjectId | null;
    post?: mongoose.Types.ObjectId | null;
} & mongoose.DefaultTimestampProps, {}, {}, {
    id: string;
}, mongoose.Document<unknown, {}, {
    type: "save" | "comment" | "like" | "follow" | "repost";
    sender: mongoose.Types.ObjectId;
    recipient: mongoose.Types.ObjectId;
    isRead: boolean;
    comment?: mongoose.Types.ObjectId | null;
    post?: mongoose.Types.ObjectId | null;
} & mongoose.DefaultTimestampProps, {
    id: string;
}, {
    timestamps: true;
}> & Omit<{
    type: "save" | "comment" | "like" | "follow" | "repost";
    sender: mongoose.Types.ObjectId;
    recipient: mongoose.Types.ObjectId;
    isRead: boolean;
    comment?: mongoose.Types.ObjectId | null;
    post?: mongoose.Types.ObjectId | null;
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    type: "save" | "comment" | "like" | "follow" | "repost";
    sender: mongoose.Types.ObjectId;
    recipient: mongoose.Types.ObjectId;
    isRead: boolean;
    comment?: mongoose.Types.ObjectId | null;
    post?: mongoose.Types.ObjectId | null;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, {
    type: "save" | "comment" | "like" | "follow" | "repost";
    sender: mongoose.Types.ObjectId;
    recipient: mongoose.Types.ObjectId;
    isRead: boolean;
    comment?: mongoose.Types.ObjectId | null;
    post?: mongoose.Types.ObjectId | null;
} & mongoose.DefaultTimestampProps, {
    id: string;
}, Omit<mongoose.DefaultSchemaOptions, "timestamps"> & {
    timestamps: true;
}> & Omit<{
    type: "save" | "comment" | "like" | "follow" | "repost";
    sender: mongoose.Types.ObjectId;
    recipient: mongoose.Types.ObjectId;
    isRead: boolean;
    comment?: mongoose.Types.ObjectId | null;
    post?: mongoose.Types.ObjectId | null;
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, unknown, {
    type: "save" | "comment" | "like" | "follow" | "repost";
    sender: mongoose.Types.ObjectId;
    recipient: mongoose.Types.ObjectId;
    isRead: boolean;
    comment?: mongoose.Types.ObjectId | null;
    post?: mongoose.Types.ObjectId | null;
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>, {
    type: "save" | "comment" | "like" | "follow" | "repost";
    sender: mongoose.Types.ObjectId;
    recipient: mongoose.Types.ObjectId;
    isRead: boolean;
    comment?: mongoose.Types.ObjectId | null;
    post?: mongoose.Types.ObjectId | null;
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export default Notification;
//# sourceMappingURL=notification.model.d.ts.map