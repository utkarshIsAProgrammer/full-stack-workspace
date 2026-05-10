import mongoose, { Document, Model } from "mongoose";

// url document interface
export interface IUrl extends Document {
  originalUrl: string;
  shortCode: string;
  createdAt: Date;
  updatedAt: Date;
}

// url schema definition
const urlSchema = new mongoose.Schema<IUrl>(
  {
    originalUrl: { type: String, required: true, trim: true },
    shortCode: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true },
);

// export model
export default mongoose.model<IUrl>("Url", urlSchema);
