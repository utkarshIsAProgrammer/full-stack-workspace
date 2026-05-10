import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import { connectDB } from "./db/db";
import { authRoutes } from "./routes/auth.routes";
import { passwordRoutes } from "./routes/password.routes";
import { userRoutes } from "./routes/user.routes";
import { postRoutes } from "./routes/post.routes";
import { commentRoutes } from "./routes/comment.routes";
import { likeRoutes } from "./routes/like.routes";
import { followRoutes } from "./routes/follow.routes";

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cookieParser());

// api routes
app.use("/api/auth", authRoutes);
app.use("/api/password", passwordRoutes);
app.use("/api/user", userRoutes);
app.use("/api/post", postRoutes);
app.use("/api/comment", commentRoutes);
app.use("/api/like", likeRoutes);
app.use("/api/follow", followRoutes);

connectDB().then(() => {
  app.listen(port, () => {
    console.log(`Server is running on PORT: ${port}`);
  });
});

// ! BUILD IMAGE UPLOAD, IMAGE UPDATE, DELETE IMAGE WITH POST
