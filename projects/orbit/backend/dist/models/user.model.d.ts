import mongoose, { InferSchemaType, HydratedDocument } from "mongoose";
declare const userSchema: mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    username: string;
    email: string;
    password: string;
    followersCount: number;
    followingCount: number;
    sharesCount: number;
    viewsCount: number;
    otp?: string | null;
    otpExpiry?: NativeDate | null;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, {
    username: string;
    email: string;
    password: string;
    followersCount: number;
    followingCount: number;
    sharesCount: number;
    viewsCount: number;
    otp?: string | null;
    otpExpiry?: NativeDate | null;
} & mongoose.DefaultTimestampProps, {
    id: string;
}, Omit<mongoose.DefaultSchemaOptions, "timestamps"> & {
    timestamps: true;
}> & Omit<{
    username: string;
    email: string;
    password: string;
    followersCount: number;
    followingCount: number;
    sharesCount: number;
    viewsCount: number;
    otp?: string | null;
    otpExpiry?: NativeDate | null;
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, unknown, {
    username: string;
    email: string;
    password: string;
    followersCount: number;
    followingCount: number;
    sharesCount: number;
    viewsCount: number;
    otp?: string | null;
    otpExpiry?: NativeDate | null;
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
type UserType = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserType> & {
    otp?: string | null;
    otpExpiry?: Date | null;
    signToken: () => string;
    comparePassword: (password: string) => Promise<boolean>;
};
export declare const User: mongoose.Model<UserDocument, {}, {}, {}, mongoose.Document<unknown, {}, UserDocument, {}, mongoose.DefaultSchemaOptions> & mongoose.Document<unknown, {}, {
    username: string;
    email: string;
    password: string;
    followersCount: number;
    followingCount: number;
    sharesCount: number;
    viewsCount: number;
    otp?: string | null;
    otpExpiry?: NativeDate | null;
} & mongoose.DefaultTimestampProps, {}, mongoose.DefaultSchemaOptions> & {
    username: string;
    email: string;
    password: string;
    followersCount: number;
    followingCount: number;
    sharesCount: number;
    viewsCount: number;
    otp?: string | null;
    otpExpiry?: NativeDate | null;
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
} & {
    id: string;
} & {
    otp?: string | null;
    otpExpiry?: Date | null;
    signToken: () => string;
    comparePassword: (password: string) => Promise<boolean>;
} & Required<{
    _id: mongoose.Types.ObjectId;
}>, any, UserDocument>;
export {};
//# sourceMappingURL=user.model.d.ts.map