import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI!);
    console.log(`mongoDB connected successfully! ${conn.connection.host}`);
    try {
      await mongoose.connection
        .collection("likes")
        .dropIndex("author_1_comment_1");
    } catch (err: any) {
      console.log(`Error dropping index! ${err.message}`);
    }
    try {
      await mongoose.connection
        .collection("likes")
        .dropIndex("author_1_post_1");
    } catch (err: any) {
      console.log(`Error dropping index! ${err.message}`);
    }
  } catch (err: any) {
    console.log(`Error connecting mongoDB! ${err.message}`);
    process.exit(1);
  }
};
