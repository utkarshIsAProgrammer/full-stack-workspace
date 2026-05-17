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
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
// api routes
app.use("/api/auth", auth_routes_1.authRoutes);
app.use("/api/password", password_routes_1.passwordRoutes);
app.use("/api/user", user_routes_1.userRoutes);
app.use("/api/post", post_routes_1.postRoutes);
app.use("/api/comment", comment_routes_1.commentRoutes);
app.use("/api/like", like_routes_1.likeRoutes);
app.use("/api/follow", follow_routes_1.followRoutes);
app.use("/api/save", saves_routes_1.saveRoutes);
app.use("/api/repost", repost_routes_1.repostRoutes);
(0, db_1.connectDB)().then(() => {
    app.listen(port, () => {
        console.log(`Server is running on PORT: ${port}`);
    });
});
// ! NEON IS LOGGED IN
/*
! --- FIXED ---:
! AUTH SECURITY: LOGIN MISUSE AND API ABUSE
! RESET AND FORGOT PASSWORD: USER STILL LOGGED IN WHEN DOING THIS
! FOLLOWERS BUG: NEGATIVE FOLLOWERS
! COMMENTS BUG: ASSIGNING WRONG PARAMETERS TO THE API
! LIKES BUG: LIKES FOR COMMENTS AND POSTS ARE DUPLICATED

! --- ADD ---:
! COUNTS FOR LIKE, COMMENT, FOLLOW, SAVE AND REPOST
 */
//# sourceMappingURL=server.js.map