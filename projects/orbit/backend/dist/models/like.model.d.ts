import mongoose from "mongoose";
declare const Like: mongoose.Model<{
    author: mongoose.Types.ObjectId;
    comment?: mongoose.Types.ObjectId | null;
    post?: mongoose.Types.ObjectId | null;
} & mongoose.DefaultTimestampProps, {}, {}, {
    id: string;
}, mongoose.Document<unknown, {}, {
    author: mongoose.Types.ObjectId;
    comment?: mongoose.Types.ObjectId | null;
    post?: mongoose.Types.ObjectId | null;
} & mongoose.DefaultTimestampProps, {
    id: string;
}, {
    timestamps: true;
}> & Omit<{
    author: mongoose.Types.ObjectId;
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
    author: mongoose.Types.ObjectId;
    comment?: mongoose.Types.ObjectId | null;
    post?: mongoose.Types.ObjectId | null;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, {
    author: mongoose.Types.ObjectId;
    comment?: mongoose.Types.ObjectId | null;
    post?: mongoose.Types.ObjectId | null;
} & mongoose.DefaultTimestampProps, {
    id: string;
}, Omit<mongoose.DefaultSchemaOptions, "timestamps"> & {
    timestamps: true;
}> & Omit<{
    author: mongoose.Types.ObjectId;
    comment?: mongoose.Types.ObjectId | null;
    post?: mongoose.Types.ObjectId | null;
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, unknown, {
    author: mongoose.Types.ObjectId;
    comment?: mongoose.Types.ObjectId | null;
    post?: mongoose.Types.ObjectId | null;
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>, {
    author: mongoose.Types.ObjectId;
    comment?: mongoose.Types.ObjectId | null;
    post?: mongoose.Types.ObjectId | null;
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export default Like;
//# sourceMappingURL=like.model.d.ts.map