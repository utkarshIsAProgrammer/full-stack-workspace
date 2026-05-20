"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
require("dotenv/config");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
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
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
app.set("trust proxy", 1);
app.use(express_1.default.json());
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
(0, db_1.connectDB)().then(() => {
    app.listen(port, () => {
        console.log(`Server is running on PORT: ${port}`);
    });
});
// ! BEN IS LOGGED IN
/*
! --- ADD ---
! SEARCH POST/PROFILE
 */
/*
TODO:
* 1. USER PROFILE AND SYNC WITH SEARCH PROFILE
 */
//# sourceMappingURL=server.js.map