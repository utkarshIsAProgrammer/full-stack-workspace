"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
require("dotenv/config");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const env_1 = require("./configs/env");
const db_1 = require("./db/db");
const auth_routes_1 = require("./routes/auth.routes");
const password_routes_1 = require("./routes/password.routes");
const user_routes_1 = require("./routes/user.routes");
const post_routes_1 = require("./routes/post.routes");
const comment_routes_1 = require("./routes/comment.routes");
const like_routes_1 = require("./routes/like.routes");
const follow_routes_1 = require("./routes/follow.routes");
const saves_routes_1 = require("./routes/saves.routes");
const repost_routes_1 = require("./routes/repost.routes");
const search_routes_1 = require("./routes/search.routes");
const notification_routes_1 = require("./routes/notification.routes");
const env = (0, env_1.validateEnv)();
const app = (0, express_1.default)();
const port = env.PORT;
const allowedOrigins = [env.CLIENT_URL];
app.set("trust proxy", 1);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
}));
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(express_1.default.json({ limit: "100kb" }));
app.use((0, cookie_parser_1.default)());
// api routes
app.use("/api/auth", auth_routes_1.authRoutes);
app.use("/api/password", password_routes_1.passwordRoutes);
app.use("/api/users", user_routes_1.userRoutes);
app.use("/api/posts", post_routes_1.postRoutes);
app.use("/api/comments", comment_routes_1.commentRoutes);
app.use("/api/likes", like_routes_1.likeRoutes);
app.use("/api/follows", follow_routes_1.followRoutes);
app.use("/api/saves", saves_routes_1.saveRoutes);
app.use("/api/reposts", repost_routes_1.repostRoutes);
app.use("/api/search", search_routes_1.searchRoutes);
app.use("/api/notifications", notification_routes_1.notificationRoutes);
(0, db_1.connectDB)().then(() => {
    app.listen(port, () => {
        console.log(`Server is running on PORT: ${port}`);
    });
});
//# sourceMappingURL=server.js.map