import mongoose from "mongoose";
declare const Comment: mongoose.Model<{
    post: mongoose.Types.ObjectId;
    content: string;
    likesCount: number;
    author: mongoose.Types.ObjectId;
    parent?: mongoose.Types.ObjectId | null;
} & mongoose.DefaultTimestampProps, {}, {}, {
    id: string;
}, mongoose.Document<unknown, {}, {
    post: mongoose.Types.ObjectId;
    content: string;
    likesCount: number;
    author: mongoose.Types.ObjectId;
    parent?: mongoose.Types.ObjectId | null;
} & mongoose.DefaultTimestampProps, {
    id: string;
}, {
    timestamps: true;
}> & Omit<{
    post: mongoose.Types.ObjectId;
    content: string;
    likesCount: number;
    author: mongoose.Types.ObjectId;
    parent?: mongoose.Types.ObjectId | null;
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    post: mongoose.Types.ObjectId;
    content: string;
    likesCount: number;
    author: mongoose.Types.ObjectId;
    parent?: mongoose.Types.ObjectId | null;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, {
    post: mongoose.Types.ObjectId;
    content: string;
    likesCount: number;
    author: mongoose.Types.ObjectId;
    parent?: mongoose.Types.ObjectId | null;
} & mongoose.DefaultTimestampProps, {
    id: string;
}, Omit<mongoose.DefaultSchemaOptions, "timestamps"> & {
    timestamps: true;
}> & Omit<{
    post: mongoose.Types.ObjectId;
    content: string;
    likesCount: number;
    author: mongoose.Types.ObjectId;
    parent?: mongoose.Types.ObjectId | null;
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, unknown, {
    post: mongoose.Types.ObjectId;
    content: string;
    likesCount: number;
    author: mongoose.Types.ObjectId;
    parent?: mongoose.Types.ObjectId | null;
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>, {
    post: mongoose.Types.ObjectId;
    content: string;
    likesCount: number;
    author: mongoose.Types.ObjectId;
    parent?: mongoose.Types.ObjectId | null;
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export default Comment;
//# sourceMappingURL=comment.model.d.ts.map