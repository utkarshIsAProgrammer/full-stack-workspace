import mongoose from "mongoose";
declare const Post: mongoose.Model<{
    sharesCount: number;
    viewsCount: number;
    title: string;
    slug: string;
    content: string;
    repostsCount: number;
    savesCount: number;
    likesCount: number;
    commentsCount: number;
    author: mongoose.Types.ObjectId;
    image?: {
        url: string;
        public_id: string;
    } | null;
} & mongoose.DefaultTimestampProps, {}, {}, {
    id: string;
}, mongoose.Document<unknown, {}, {
    sharesCount: number;
    viewsCount: number;
    title: string;
    slug: string;
    content: string;
    repostsCount: number;
    savesCount: number;
    likesCount: number;
    commentsCount: number;
    author: mongoose.Types.ObjectId;
    image?: {
        url: string;
        public_id: string;
    } | null;
} & mongoose.DefaultTimestampProps, {
    id: string;
}, {
    timestamps: true;
}> & Omit<{
    sharesCount: number;
    viewsCount: number;
    title: string;
    slug: string;
    content: string;
    repostsCount: number;
    savesCount: number;
    likesCount: number;
    commentsCount: number;
    author: mongoose.Types.ObjectId;
    image?: {
        url: string;
        public_id: string;
    } | null;
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    sharesCount: number;
    viewsCount: number;
    title: string;
    slug: string;
    content: string;
    repostsCount: number;
    savesCount: number;
    likesCount: number;
    commentsCount: number;
    author: mongoose.Types.ObjectId;
    image?: {
        url: string;
        public_id: string;
    } | null;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, {
    sharesCount: number;
    viewsCount: number;
    title: string;
    slug: string;
    content: string;
    repostsCount: number;
    savesCount: number;
    likesCount: number;
    commentsCount: number;
    author: mongoose.Types.ObjectId;
    image?: {
        url: string;
        public_id: string;
    } | null;
} & mongoose.DefaultTimestampProps, {
    id: string;
}, Omit<mongoose.DefaultSchemaOptions, "timestamps"> & {
    timestamps: true;
}> & Omit<{
    sharesCount: number;
    viewsCount: number;
    title: string;
    slug: string;
    content: string;
    repostsCount: number;
    savesCount: number;
    likesCount: number;
    commentsCount: number;
    author: mongoose.Types.ObjectId;
    image?: {
        url: string;
        public_id: string;
    } | null;
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, unknown, {
    sharesCount: number;
    viewsCount: number;
    title: string;
    slug: string;
    content: string;
    repostsCount: number;
    savesCount: number;
    likesCount: number;
    commentsCount: number;
    author: mongoose.Types.ObjectId;
    image?: {
        url: string;
        public_id: string;
    } | null;
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>, {
    sharesCount: number;
    viewsCount: number;
    title: string;
    slug: string;
    content: string;
    repostsCount: number;
    savesCount: number;
    likesCount: number;
    commentsCount: number;
    author: mongoose.Types.ObjectId;
    image?: {
        url: string;
        public_id: string;
    } | null;
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export default Post;
//# sourceMappingURL=post.model.d.ts.map