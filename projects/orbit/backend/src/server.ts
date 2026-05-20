import express from "express";
import "dotenv/config";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { validateEnv } from "./configs/env";
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
import { searchRoutes } from "./routes/search.routes";
import { notificationRoutes } from "./routes/notification.routes";

const env = validateEnv();

const app = express();
const port = env.PORT;
const allowedOrigins = [env.CLIENT_URL];

app.set("trust proxy", 1);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(express.json({ limit: "100kb" }));
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
app.use("/api/search", searchRoutes);
app.use("/api/notifications", notificationRoutes);

connectDB().then(() => {
  app.listen(port, () => {
    console.log(`Server is running on PORT: ${port}`);
  });
});
