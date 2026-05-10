import mongoose, { Document } from "mongoose";
export interface IUrl extends Document {
    originalUrl: string;
    shortCode: string;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IUrl, {}, {}, {}, mongoose.Document<unknown, {}, IUrl, {}, mongoose.DefaultSchemaOptions> & IUrl & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IUrl>;
export default _default;
//# sourceMappingURL=url.model.d.ts.map