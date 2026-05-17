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
import { saveRoutes } from "./routes/saves.routes";
import { repostRoutes } from "./routes/repost.routes";

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cookieParser());

// api routes
app.use("/api/auth", authRoutes);
app.use("/api/password", passwordRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/likes", likeRoutes);
app.use("/api/follows", followRoutes);
app.use("/api/saves", saveRoutes);
app.use("/api/reposts", repostRoutes);

connectDB().then(() => {
  app.listen(port, () => {
    console.log(`Server is running on PORT: ${port}`);
  });
});

// ! NEON IS LOGGED IN

/* 
! --- FIX ---
! REPLACE getAll CONTROLLER TO THE user.controllers.ts

! --- ADD ---
! SHARE PROFILE / POST
 */
